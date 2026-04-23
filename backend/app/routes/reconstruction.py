# backend/app/routes/reconstruction.py
import os
import shutil
import datetime
import logging
import psycopg2.extras
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

import database
from app.routes.auth import get_current_user
from app.ml.triposr_runner import run_triposr_async

router = APIRouter()

logger = logging.getLogger("forenvision.reconstruction")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)
logger.setLevel(logging.INFO)

OUTPUT_BASE = os.environ.get(
    "RECONSTRUCTION_OUTPUT_DIR",
    os.path.join("ml", "outputs", "3d_models"),
)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tiff", ".tif"}


class ReconstructionStartRequest(BaseModel):
    case_id: int
    image_filename: str
    image_filepath: str


def _db_update_job(job_id: int, **fields) -> None:
    if not fields:
        return
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [datetime.datetime.now(), job_id]
    try:
        conn = database.get_connection()
        cur = conn.cursor()
        cur.execute(
            f"UPDATE reconstruction_jobs SET {set_clause}, updated_at = %s WHERE id = %s",
            values,
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        logger.exception("_db_update_job failed for job_id=%d", job_id)


def _assert_case_access(cur, case_id: int, current_user: dict) -> dict:
    cur.execute("SELECT id, user_id FROM cases WHERE id = %s", (case_id,))
    case = cur.fetchone()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if current_user.get("role") != "admin" and case["user_id"] != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Access denied")
    return case


@router.get("/reconstruction/case/{case_id}/images")
def list_case_images(
    case_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        _assert_case_access(cur, case_id, current_user)

        cur.execute(
            "SELECT filename, filepath FROM evidence WHERE case_id = %s ORDER BY uploaded_at DESC",
            (case_id,),
        )
        rows = cur.fetchall()

        images = []
        for row in rows:
            ext = os.path.splitext(row["filename"] or "")[1].lower()
            if ext in IMAGE_EXTENSIONS:
                images.append({
                    "filename": row["filename"],
                    "filepath": row["filepath"],
                    "url": f"/uploads/{row['filename']}",
                })

        logger.info("case %d — %d image(s) available for reconstruction", case_id, len(images))
        return {"images": images}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing case images")
        raise HTTPException(status_code=500, detail=f"Error listing images: {str(e)}")
    finally:
        cur.close()
        conn.close()


@router.post("/reconstruction/start")
def start_reconstruction(
    payload: ReconstructionStartRequest,
    current_user: dict = Depends(get_current_user),
):
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        _assert_case_access(cur, payload.case_id, current_user)

        if not os.path.isfile(payload.image_filepath):
            raise HTTPException(
                status_code=422,
                detail=f"Image file not found on server: {payload.image_filepath}",
            )

        cur.execute(
            """
            INSERT INTO reconstruction_jobs
                (case_id, image_filename, image_filepath, status, progress)
            VALUES (%s, %s, %s, 'running', 1)
            RETURNING *
            """,
            (payload.case_id, payload.image_filename, payload.image_filepath),
        )
        job = cur.fetchone()
        conn.commit()

        job_id = job["id"]
        output_dir = os.path.join(OUTPUT_BASE, f"case_{payload.case_id}", f"job_{job_id}")
        os.makedirs(output_dir, exist_ok=True)

        logger.info("Reconstruction job %d created for case %d, image %s",
                    job_id, payload.case_id, payload.image_filename)

        def on_progress(pct: int) -> None:
            _db_update_job(job_id, status="running", progress=pct)

        def on_done(output_path: str) -> None:
            logger.info("Job %d done — output: %s", job_id, output_path)
            rel = os.path.relpath(output_path, OUTPUT_BASE).replace("\\", "/")
            _db_update_job(job_id, status="done", progress=100, output_path=rel)

        def on_error(message: str) -> None:
            logger.error("Job %d failed: %s", job_id, message)
            _db_update_job(job_id, status="failed", error_message=message)

        run_triposr_async(
            image_filepath=payload.image_filepath,
            output_dir=output_dir,
            on_progress=on_progress,
            on_done=on_done,
            on_error=on_error,
        )

        return {"job": dict(job)}

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("Error starting reconstruction job")
        raise HTTPException(status_code=500, detail=f"Error starting reconstruction: {str(e)}")
    finally:
        cur.close()
        conn.close()


@router.get("/reconstruction/status/{job_id}")
def get_job_status(
    job_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("SELECT * FROM reconstruction_jobs WHERE id = %s", (job_id,))
        job = cur.fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        _assert_case_access(cur, job["case_id"], current_user)
        return {"job": dict(job)}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching job status")
        raise HTTPException(status_code=500, detail=f"Error fetching job status: {str(e)}")
    finally:
        cur.close()
        conn.close()


@router.get("/reconstruction/case/{case_id}/jobs")
def list_case_jobs(
    case_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        _assert_case_access(cur, case_id, current_user)

        cur.execute(
            "SELECT * FROM reconstruction_jobs WHERE case_id = %s ORDER BY created_at DESC",
            (case_id,),
        )
        jobs = cur.fetchall()
        return {"jobs": [dict(j) for j in jobs]}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listing case jobs")
        raise HTTPException(status_code=500, detail=f"Error listing jobs: {str(e)}")
    finally:
        cur.close()
        conn.close()


@router.delete("/reconstruction/jobs/{job_id}")
def delete_job(
    job_id: int,
    current_user: dict = Depends(get_current_user),
):
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("SELECT * FROM reconstruction_jobs WHERE id = %s", (job_id,))
        job = cur.fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        _assert_case_access(cur, job["case_id"], current_user)

        # Delete output folder from disk
        job_folder = os.path.join(OUTPUT_BASE, f"case_{job['case_id']}", f"job_{job_id}")
        if os.path.isdir(job_folder):
            shutil.rmtree(job_folder, ignore_errors=True)
            logger.info("Deleted output folder: %s", job_folder)

        cur.execute("DELETE FROM reconstruction_jobs WHERE id = %s", (job_id,))
        conn.commit()

        return {"success": True, "deleted_id": job_id}

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("Error deleting job")
        raise HTTPException(status_code=500, detail=f"Error deleting job: {str(e)}")
    finally:
        cur.close()
        conn.close()