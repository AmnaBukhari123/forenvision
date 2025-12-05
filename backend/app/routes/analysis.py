# app/routes/analysis.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import os
import json
import logging
import database
import psycopg2.extras
from psycopg2.extras import Json
from app.routes.auth import get_current_user
from app.ml.model_service import blood_detector, crimescene_detector, detect_with_model

router = APIRouter()

# Configure logger for this module
logger = logging.getLogger("forenvision.analysis")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)
logger.setLevel(logging.INFO)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

class ObjectDetectionRequest(BaseModel):
    evidence_id: Optional[int] = None
    model_type: Optional[str] = "crime_scene"  # "crime_scene" or "blood"
    conf_threshold: Optional[float] = 0.25


def _exec_with_logging(cursor, query: str, params: tuple):
    """
    Helper to execute a query but first log the query and params and
    validate placeholder/param count to avoid psycopg2 IndexError confusion.
    """
    try:
        # Log short preview (avoid dumping huge JSON directly)
        param_preview = []
        for p in params:
            if isinstance(p, (str, int, float)) or p is None:
                param_preview.append(p)
            else:
                # show type for big objects
                param_preview.append(f"<{type(p).__name__}>")

        logger.debug("Executing SQL: %s", query)
        logger.debug("With params preview: %s", param_preview)

        # Quick sanity check: count %s placeholders (naive count)
        placeholder_count = query.count("%s")
        if placeholder_count != len(params):
            logger.error(
                "Placeholder/param mismatch: %s placeholders vs %s params. Query: %s",
                placeholder_count, len(params), query
            )
            # still attempt to execute to let DB raise a meaningful error,
            # but raise more descriptive error to help debugging
            raise ValueError(f"SQL placeholder count ({placeholder_count}) != params count ({len(params)})")

        cursor.execute(query, params)
    except Exception:
        # Log full exception and re-raise
        logger.exception("SQL execution failed. Query: %s, params_preview: %s", query, param_preview)
        raise


@router.post("/cases/{case_id}/run_object_detection")
async def run_object_detection(case_id: int, request: ObjectDetectionRequest, current_user: dict = Depends(get_current_user)):
    """
    Run object detection on evidence images
    
    Request body:
    - evidence_id (optional): Specific evidence to analyze, or all if not provided
    - model_type (optional): "crime_scene" (default) or "blood"
    - conf_threshold (optional): Confidence threshold (default: 0.25)
    """
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Validate model type
    model_type = request.model_type.lower() if request.model_type else "crime_scene"
    if model_type not in ["crime_scene", "blood", "blood_detection"]:
        raise HTTPException(status_code=400, detail="Invalid model_type. Must be 'crime_scene' or 'blood'")

    try:
        # Verify case exists and belongs to user
        _exec_with_logging(
            cur,
            "SELECT id FROM cases WHERE id = %s AND user_id = %s",
            (case_id, current_user.get("id"))
        )
        case_row = cur.fetchone()
        if not case_row:
            raise HTTPException(status_code=404, detail="Case not found")

        # Choose evidence rows
        if request.evidence_id:
            _exec_with_logging(
                cur,
                "SELECT * FROM evidence WHERE id = %s AND case_id = %s AND user_id = %s",
                (request.evidence_id, case_id, current_user.get("id"))
            )
        else:
            _exec_with_logging(
                cur,
                "SELECT * FROM evidence WHERE case_id = %s AND user_id = %s AND (filename ILIKE '%.jpg' OR filename ILIKE '%.jpeg' OR filename ILIKE '%.png') ORDER BY uploaded_at DESC",
                (case_id, current_user.get("id"))
            )

        evidence_list = cur.fetchall()
        if not evidence_list:
            raise HTTPException(status_code=404, detail="No evidence found for object detection")

        results_summary = []

        for evidence in evidence_list:
            evidence_id = evidence.get('id')
            evidence_path = evidence.get('filepath')
            if not evidence_path or not os.path.exists(evidence_path):
                logger.warning("Evidence file missing or path invalid (id=%s): %s", evidence_id, evidence_path)
                continue

            try:
                # Run the appropriate model
                detection_result = detect_with_model(
                    evidence_path, 
                    model_type=model_type,
                    conf_threshold=request.conf_threshold
                )

                # Use psycopg2.extras.Json to store JSON safely (works for json/jsonb)
                insert_query = "INSERT INTO object_detection_results (case_id, evidence_id, results, model_type, user_id) VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at"
                params = (
                    case_id, 
                    evidence_id, 
                    Json(detection_result), 
                    model_type,
                    current_user.get("id")
                )

                # Log actual insertion params length / preview in helper
                _exec_with_logging(cur, insert_query, params)

                result_record = cur.fetchone()

                results_summary.append({
                    'evidence_id': evidence_id,
                    'evidence_filename': evidence.get('filename'),
                    'model_type': model_type,
                    'detection_result': detection_result,
                    'result_id': result_record['id'] if result_record else None,
                    'created_at': result_record['created_at'] if result_record else None
                })

            except Exception as e:
                # Per-evidence error: log full context and continue
                logger.exception("Error running detection for evidence id %s path %s: %s", evidence_id, evidence_path, str(e))
                continue

        conn.commit()

        model_name = "Blood Detection" if model_type in ["blood", "blood_detection"] else "Crime Scene Detection"
        return {
            "success": True,
            "message": f"{model_name} completed on {len(results_summary)} evidence files",
            "model_type": model_type,
            "results": results_summary
        }

    except HTTPException:
        conn.rollback()
        raise
    except ValueError as ve:
        # This covers placeholder/param mismatch from our helper
        conn.rollback()
        logger.exception("ValueError in run_object_detection: %s", str(ve))
        raise HTTPException(status_code=500, detail=f"Server error (query params mismatch): {str(ve)}")
    except Exception as e:
        conn.rollback()
        logger.exception("Object detection endpoint failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Object detection failed on server. Check server logs.")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


def _safe_parse_results_field(raw_value):
    if raw_value is None:
        return None
    if isinstance(raw_value, (dict, list)):
        return raw_value
    if isinstance(raw_value, (bytes, bytearray)):
        try:
            raw_value = raw_value.decode('utf-8')
        except Exception:
            return raw_value
    if isinstance(raw_value, str):
        try:
            return json.loads(raw_value)
        except Exception:
            logger.warning("Failed to json.loads results field; returning raw string")
            return raw_value
    return raw_value


@router.get("/cases/{case_id}/object_detection_results")
def get_object_detection_results(
    case_id: int, 
    model_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get object detection results for a case
    
    Query parameters:
    - model_type (optional): Filter by model type ("crime_scene" or "blood")
    """
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        _exec_with_logging(
            cur, 
            "SELECT id FROM cases WHERE id = %s AND user_id = %s", 
            (case_id, current_user.get("id"))
        )
        case_row = cur.fetchone()
        if not case_row:
            raise HTTPException(status_code=404, detail="Case not found")

        # Build query with optional model_type filter
        if model_type:
            query = "SELECT odr.*, e.filename as evidence_filename, e.filepath as evidence_filepath FROM object_detection_results odr JOIN evidence e ON odr.evidence_id = e.id WHERE odr.case_id = %s AND odr.user_id = %s AND odr.model_type = %s ORDER BY odr.created_at DESC"
            params = (case_id, current_user.get("id"), model_type.lower())
        else:
            query = "SELECT odr.*, e.filename as evidence_filename, e.filepath as evidence_filepath FROM object_detection_results odr JOIN evidence e ON odr.evidence_id = e.id WHERE odr.case_id = %s AND odr.user_id = %s ORDER BY odr.created_at DESC"
            params = (case_id, current_user.get("id"))

        _exec_with_logging(cur, query, params)
        results = cur.fetchall()

        for result in results:
            try:
                result['results'] = _safe_parse_results_field(result.get('results'))
            except Exception:
                logger.exception("Failed to parse results for record id %s", result.get('id'))
                result['results'] = result.get('results')

        return {
            "detection_results": results,
            "filter_model_type": model_type
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching object detection results: %s", str(e))
        raise HTTPException(status_code=500, detail="Error fetching detection results. Check server logs.")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


@router.get("/object_detection_results/{result_id}")
def get_detection_result(result_id: int, current_user: dict = Depends(get_current_user)):
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        _exec_with_logging(
            cur,
            "SELECT odr.*, e.filename as evidence_filename, e.filepath as evidence_filepath FROM object_detection_results odr JOIN evidence e ON odr.evidence_id = e.id WHERE odr.id = %s AND odr.user_id = %s",
            (result_id, current_user.get("id"))
        )
        result = cur.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Detection result not found")

        result['results'] = _safe_parse_results_field(result.get('results'))
        return {"detection_result": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching detection result: %s", str(e))
        raise HTTPException(status_code=500, detail="Error fetching detection result. Check server logs.")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


@router.delete("/object_detection_results/{result_id}")
def delete_detection_result(result_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a specific object detection result"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Verify the detection result exists and belongs to the user
        _exec_with_logging(
            cur,
            "SELECT id, case_id, evidence_id, model_type FROM object_detection_results WHERE id = %s AND user_id = %s",
            (result_id, current_user.get("id"))
        )
        result = cur.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Detection result not found")

        # Delete the detection result
        _exec_with_logging(
            cur,
            "DELETE FROM object_detection_results WHERE id = %s AND user_id = %s",
            (result_id, current_user.get("id"))
        )
        
        conn.commit()

        return {
            "success": True,
            "message": "Detection result deleted successfully",
            "deleted_id": result_id,
            "model_type": result.get('model_type')
        }

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("Error deleting detection result: %s", str(e))
        raise HTTPException(status_code=500, detail="Error deleting detection result. Check server logs.")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


@router.delete("/cases/{case_id}/object_detection_results")
def delete_all_case_detection_results(
    case_id: int, 
    model_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete object detection results for a specific case
    
    Query parameters:
    - model_type (optional): Delete only results from specific model ("crime_scene" or "blood")
                            If not provided, deletes all results for the case
    """
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Verify case exists and belongs to user
        _exec_with_logging(
            cur,
            "SELECT id FROM cases WHERE id = %s AND user_id = %s",
            (case_id, current_user.get("id"))
        )
        case_row = cur.fetchone()
        if not case_row:
            raise HTTPException(status_code=404, detail="Case not found")

        # Build queries with optional model_type filter
        if model_type:
            count_query = "SELECT COUNT(*) as count FROM object_detection_results WHERE case_id = %s AND user_id = %s AND model_type = %s"
            delete_query = "DELETE FROM object_detection_results WHERE case_id = %s AND user_id = %s AND model_type = %s"
            params = (case_id, current_user.get("id"), model_type.lower())
        else:
            count_query = "SELECT COUNT(*) as count FROM object_detection_results WHERE case_id = %s AND user_id = %s"
            delete_query = "DELETE FROM object_detection_results WHERE case_id = %s AND user_id = %s"
            params = (case_id, current_user.get("id"))

        # Count how many results will be deleted
        _exec_with_logging(cur, count_query, params)
        count_result = cur.fetchone()
        deleted_count = count_result['count'] if count_result else 0

        # Delete detection results
        _exec_with_logging(cur, delete_query, params)
        
        conn.commit()

        message = f"Deleted {deleted_count} detection result(s) for case #{case_id}"
        if model_type:
            message += f" (model: {model_type})"

        return {
            "success": True,
            "message": message,
            "deleted_count": deleted_count,
            "filter_model_type": model_type
        }

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("Error deleting case detection results: %s", str(e))
        raise HTTPException(status_code=500, detail="Error deleting detection results. Check server logs.")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


@router.get("/models/info")
def get_models_info(current_user: dict = Depends(get_current_user)):
    """Get information about available detection models"""
    return {
        "available_models": [
            {
                "type": "crime_scene",
                "name": "Crime Scene Detection",
                "description": "Detects 13 types of crime scene objects including evidence, weapons, and human elements",
                "classes": crimescene_detector.class_names,
                "categories": list(crimescene_detector.category_mapping.keys())
            },
            {
                "type": "blood",
                "name": "Blood Detection",
                "description": "Specialized detection for blood and bloodstain evidence",
                "classes": blood_detector.class_names,
                "categories": list(blood_detector.category_mapping.keys())
            }
        ]
    }