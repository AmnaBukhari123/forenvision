# app/routes/cases.py - WITH ENHANCED DEBUGGING

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel
from typing import Optional
import datetime
import os
import logging
import database
import psycopg2.extras
from app.routes.auth import get_current_user

router = APIRouter()

# Setup logger
logger = logging.getLogger("forenvision.cases")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)
logger.setLevel(logging.INFO)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# =============== CASE MODELS ===============
class CaseIn(BaseModel):
    name: str
    description: Optional[str] = None
    incident_date: Optional[datetime.datetime] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    client: Optional[str] = None
    investigating_officer: Optional[str] = None
    status: Optional[str] = "New"

class CaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    incident_date: Optional[datetime.datetime] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    client: Optional[str] = None
    investigating_officer: Optional[str] = None
    status: Optional[str] = None

class CaseAcceptance(BaseModel):
    acceptance_status: str
    rejection_reason: Optional[str] = None

# =============== CASE ROUTES ===============
@router.post("/cases")
def create_case(case: CaseIn, current_user: dict = Depends(get_current_user)):
    """Create a new case for the authenticated user."""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        logger.info(f"Creating case for user {current_user.get('id')}: {case.name}")
        
        cur.execute(
            """
            INSERT INTO cases (name, description, incident_date, category, priority, 
                              client, investigating_officer, user_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING *;
            """,
            (
                case.name,
                case.description,
                case.incident_date,
                case.category,
                case.priority,
                case.client,
                case.investigating_officer,
                current_user["id"],
            ),
        )
        new_case = cur.fetchone()
        conn.commit()
        
        logger.info(f"Case created successfully: ID {new_case['id']}")
        return {"case": new_case}
    except Exception as e:
        conn.rollback()
        logger.exception(f"Error creating case: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating case: {str(e)}")
    finally:
        cur.close()
        conn.close()

@router.get("/cases")
def list_cases(
    status: Optional[str] = None, 
    q: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Return cases. Admins see all cases, others see only their own."""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        user_id = current_user.get("id")
        user_role = current_user.get("role")
        
        logger.info(f"=" * 80)
        logger.info(f"LIST CASES REQUEST")
        logger.info(f"User ID: {user_id}")
        logger.info(f"User Role: {user_role}")
        logger.info(f"Status Filter: {status}")
        logger.info(f"Query Filter: {q}")
        logger.info(f"=" * 80)
        
        # First, let's check ALL cases in the database for this user
        cur.execute("""
            SELECT 
                id, 
                name, 
                user_id, 
                status, 
                acceptance_status, 
                investigating_officer,
                created_at
            FROM cases 
            WHERE user_id = %s
            ORDER BY created_at DESC
        """, (user_id,))
        all_user_cases = cur.fetchall()
        
        logger.info(f"DEBUG: Found {len(all_user_cases)} TOTAL cases for user {user_id}")
        for case in all_user_cases:
            logger.info(f"  - Case ID: {case['id']}, Name: {case['name']}, "
                       f"Status: {case['status']}, Acceptance: {case['acceptance_status']}, "
                       f"Officer: {case['investigating_officer']}")
        
        # Now build the actual query based on role
        if user_role == "admin":
            query = """
                SELECT c.*, u.name as investigator_name, u.email as investigator_email
                FROM cases c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE 1=1
            """
            params = []
        else:
            query = """
                SELECT * FROM cases 
                WHERE user_id = %s
            """
            params = [user_id]
        
        if status:
            query += " AND c.status = %s" if user_role == "admin" else " AND status = %s"
            params.append(status)
        elif q:
            if user_role == "admin":
                query += " AND (c.name ILIKE %s OR c.description ILIKE %s)"
            else:
                query += " AND (name ILIKE %s OR description ILIKE %s)"
            params.extend([f"%{q}%", f"%{q}%"])
        
        query += " ORDER BY updated_at DESC" if user_role != "admin" else " ORDER BY c.updated_at DESC"
        
        logger.info(f"Executing query: {query}")
        logger.info(f"With params: {params}")
        
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        
        logger.info(f"Query returned {len(rows)} cases")
        for row in rows:
            logger.info(f"  - Returning Case ID: {row['id']}, Name: {row['name']}, "
                       f"Status: {row.get('status')}, Acceptance: {row.get('acceptance_status')}")
        
        logger.info(f"=" * 80)
        
        return {"cases": rows}
    except Exception as e:
        logger.exception(f"Error listing cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing cases: {str(e)}")
    finally:
        cur.close()
        conn.close()

@router.get("/cases/{case_id}")
def get_case(case_id: int, current_user: dict = Depends(get_current_user)):
    """Fetch a specific case. Admins can view any case, others only their own."""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        user_id = current_user.get("id")
        user_role = current_user.get("role")
        logger.info(f"Fetching case {case_id} for user {user_id} (role: {user_role})")
        
        # First check if case exists at all
        cur.execute("SELECT id, user_id FROM cases WHERE id = %s", (case_id,))
        case_check = cur.fetchone()
        
        if not case_check:
            logger.warning(f"Case {case_id} does not exist in database")
            raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
        
        # Admin can view any case, others only their own
        if user_role != "admin" and case_check['user_id'] != user_id:
            logger.warning(f"Case {case_id} belongs to user {case_check['user_id']}, not {user_id}")
            raise HTTPException(status_code=403, detail="Access denied: This case belongs to another user")
        
        # Fetch full case data
        if user_role == "admin":
            cur.execute("SELECT * FROM cases WHERE id = %s", (case_id,))
        else:
            cur.execute("SELECT * FROM cases WHERE id = %s AND user_id = %s", 
                        (case_id, user_id))
        case_row = cur.fetchone()
        
        # Fetch evidence
        if user_role == "admin":
            cur.execute(
                "SELECT * FROM evidence WHERE case_id = %s ORDER BY uploaded_at DESC",
                (case_id,),
            )
        else:
            cur.execute(
                "SELECT * FROM evidence WHERE case_id = %s AND user_id = %s ORDER BY uploaded_at DESC",
                (case_id, user_id),
            )
        evidence = cur.fetchall()
        
        logger.info(f"Successfully fetched case {case_id} with {len(evidence)} evidence files")
        return {"case": case_row, "evidence": evidence}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching case {case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching case: {str(e)}")
    finally:
        cur.close()
        conn.close()

@router.put("/cases/{case_id}")
def update_case(case_id: int, case_update: CaseIn, current_user: dict = Depends(get_current_user)):
    """Update a case only if it belongs to the authenticated user."""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        user_id = current_user.get("id")
        logger.info(f"Updating case {case_id} for user {user_id}")
        
        # Check if case exists AND belongs to user
        cur.execute("SELECT id FROM cases WHERE id = %s AND user_id = %s", 
                    (case_id, user_id))
        if not cur.fetchone():
            logger.warning(f"Case {case_id} not found or access denied for user {user_id}")
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Build dynamic update query
        update_fields = []
        params = []
        
        if case_update.name is not None:
            update_fields.append("name = %s")
            params.append(case_update.name)
        if case_update.description is not None:
            update_fields.append("description = %s")
            params.append(case_update.description)
        if case_update.incident_date is not None:
            update_fields.append("incident_date = %s")
            params.append(case_update.incident_date)
        if case_update.category is not None:
            update_fields.append("category = %s")
            params.append(case_update.category)
        if case_update.priority is not None:
            update_fields.append("priority = %s")
            params.append(case_update.priority)
        if case_update.client is not None:
            update_fields.append("client = %s")
            params.append(case_update.client)
        if case_update.investigating_officer is not None:
            update_fields.append("investigating_officer = %s")
            params.append(case_update.investigating_officer)
        
        update_fields.append("status = %s")
        params.append(case_update.status if hasattr(case_update, 'status') else 'New')
        
        update_fields.append("updated_at = %s")
        params.append(datetime.datetime.now())
        
        params.append(case_id)
        params.append(user_id)
        
        query = f"UPDATE cases SET {', '.join(update_fields)} WHERE id = %s AND user_id = %s RETURNING *"
        
        cur.execute(query, tuple(params))
        updated_case = cur.fetchone()
        conn.commit()
        
        logger.info(f"Case {case_id} updated successfully")
        return {"case": updated_case}
        
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception(f"Error updating case {case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating case: {str(e)}")
    finally:
        cur.close()
        conn.close()

@router.delete("/cases/{case_id}")
def delete_case(case_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a case only if it belongs to the authenticated user."""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        user_id = current_user.get("id")
        logger.info(f"Deleting case {case_id} for user {user_id}")
        
        cur.execute("DELETE FROM cases WHERE id = %s AND user_id = %s RETURNING id;", 
                    (case_id, user_id))
        deleted = cur.fetchone()
        conn.commit()
        
        if not deleted:
            logger.warning(f"Case {case_id} not found or access denied for user {user_id}")
            raise HTTPException(status_code=404, detail="Case not found")
        
        logger.info(f"Case {case_id} deleted successfully")
        return {"detail": "Case deleted successfully"}
        
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception(f"Error deleting case {case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting case: {str(e)}")
    finally:
        cur.close()
        conn.close()

# =============== EVIDENCE ROUTES ===============
@router.post("/cases/{case_id}/evidence")
async def upload_evidence(
    case_id: int, 
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Attach evidence only if the case belongs to the authenticated user."""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        user_id = current_user.get("id")
        logger.info(f"Uploading evidence for case {case_id}, user {user_id}")
        
        # Verify case exists AND belongs to user
        cur.execute("SELECT id FROM cases WHERE id = %s AND user_id = %s", 
                    (case_id, user_id))
        case_row = cur.fetchone()
        
        if not case_row:
            logger.warning(f"Case {case_id} not found or access denied for user {user_id}")
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Use numeric ID in filename
        filename = f"case_{case_id}_{int(datetime.datetime.utcnow().timestamp())}_{file.filename}"
        path = os.path.join(UPLOAD_FOLDER, filename)
        
        with open(path, "wb") as f:
            f.write(await file.read())
        
        # Insert evidence with user_id
        cur.execute(
            "INSERT INTO evidence (case_id, filename, filepath, user_id) VALUES (%s, %s, %s, %s) RETURNING *",
            (case_id, filename, path, user_id),
        )
        new_ev = cur.fetchone()
        conn.commit()
        
        logger.info(f"Evidence uploaded successfully: {filename}")
        return {"evidence": new_ev}
        
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception(f"Error uploading evidence: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading evidence: {str(e)}")
    finally:
        cur.close()
        conn.close()

@router.delete("/evidence/{evidence_id}")
def delete_evidence(evidence_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a specific evidence file"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        user_id = current_user.get("id")
        logger.info(f"Deleting evidence {evidence_id} for user {user_id}")
        
        cur.execute(
            """SELECT id, filepath, filename, case_id 
               FROM evidence 
               WHERE id = %s AND user_id = %s""",
            (evidence_id, user_id)
        )
        evidence = cur.fetchone()
        
        if not evidence:
            logger.warning(f"Evidence {evidence_id} not found or access denied for user {user_id}")
            raise HTTPException(status_code=404, detail="Evidence not found")
        
        if evidence['filepath'] and os.path.exists(evidence['filepath']):
            try:
                os.remove(evidence['filepath'])
                logger.info(f"Deleted evidence file: {evidence['filepath']}")
            except Exception as e:
                logger.warning(f"Failed to delete evidence file {evidence['filepath']}: {str(e)}")
        
        cur.execute(
            "DELETE FROM object_detection_results WHERE evidence_id = %s",
            (evidence_id,)
        )
        deleted_detections = cur.rowcount
        logger.info(f"Deleted {deleted_detections} detection results for evidence {evidence_id}")
        
        cur.execute(
            "DELETE FROM evidence WHERE id = %s AND user_id = %s",
            (evidence_id, user_id)
        )
        
        conn.commit()
        
        logger.info(f"Evidence {evidence_id} deleted successfully")
        return {
            "success": True,
            "message": "Evidence deleted successfully",
            "deleted_id": evidence_id,
            "filename": evidence['filename'],
            "deleted_detections": deleted_detections
        }
        
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("Error deleting evidence: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error deleting evidence: {str(e)}")
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass

# =============== CASE ACCEPTANCE ROUTES ===============
@router.post("/cases/{case_id}/accept")
def accept_case(
    case_id: int,
    acceptance: CaseAcceptance,
    current_user: dict = Depends(get_current_user)
):
    """Accept or decline a case assignment"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        user_id = current_user.get("id")
        
        logger.info(f"=" * 80)
        logger.info(f"CASE ACCEPTANCE REQUEST")
        logger.info(f"Case ID: {case_id}")
        logger.info(f"User ID: {user_id}")
        logger.info(f"Action: {acceptance.acceptance_status}")
        logger.info(f"=" * 80)
        
        # Verify case belongs to user
        cur.execute("SELECT * FROM cases WHERE id = %s AND user_id = %s", (case_id, user_id))
        case_row = cur.fetchone()
        
        if not case_row:
            logger.error(f"Case {case_id} not found for user {user_id}")
            raise HTTPException(status_code=404, detail="Case not found or access denied")
        
        logger.info(f"Current case status: {case_row.get('status')}")
        logger.info(f"Current acceptance status: {case_row.get('acceptance_status')}")
        
        # Check if already processed
        if case_row.get('acceptance_status') in ['accepted', 'declined']:
            raise HTTPException(
                status_code=400, 
                detail=f"Case already {case_row['acceptance_status']}"
            )
        
        # Validate acceptance status
        if acceptance.acceptance_status not in ['accepted', 'declined']:
            raise HTTPException(status_code=400, detail="Invalid acceptance status")
        
        # Update case
        if acceptance.acceptance_status == 'accepted':
            cur.execute("""
                UPDATE cases 
                SET acceptance_status = %s, 
                    accepted_at = %s,
                    status = 'Active',
                    updated_at = %s
                WHERE id = %s AND user_id = %s
                RETURNING *
            """, ('accepted', datetime.datetime.now(), datetime.datetime.now(), case_id, user_id))
        else:  # declined
            cur.execute("""
                UPDATE cases 
                SET acceptance_status = %s, 
                    rejection_reason = %s,
                    status = 'Declined',
                    updated_at = %s
                WHERE id = %s AND user_id = %s
                RETURNING *
            """, ('declined', acceptance.rejection_reason, datetime.datetime.now(), case_id, user_id))
        
        updated_case = cur.fetchone()
        conn.commit()
        
        logger.info(f"Case {case_id} {acceptance.acceptance_status} successfully")
        logger.info(f"New status: {updated_case.get('status')}")
        logger.info(f"New acceptance status: {updated_case.get('acceptance_status')}")
        logger.info(f"=" * 80)
        
        return {
            "message": f"Case {acceptance.acceptance_status} successfully",
            "case": updated_case
        }
        
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception(f"Error processing case acceptance: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing acceptance: {str(e)}")
    finally:
        cur.close()
        conn.close()