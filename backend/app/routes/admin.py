from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import datetime
import os
import psycopg2.extras
import database
from app.routes.auth import get_current_user
import logging

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)

CONTACT_UPLOADS = "uploads/contact_requests"
os.makedirs(CONTACT_UPLOADS, exist_ok=True)

# =============== MIDDLEWARE ===============
def require_admin(current_user: dict = Depends(get_current_user)):
    """Middleware to ensure user is an admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def require_admin_or_investigator(current_user: dict = Depends(get_current_user)):
    """Middleware to ensure user is admin or investigator"""
    if current_user.get("role") not in ["admin", "investigator"]:
        raise HTTPException(status_code=403, detail="Admin or investigator access required")
    return current_user

# =============== MODELS ===============
class ContactRequestUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[int] = None
    admin_notes: Optional[str] = None

class ConvertToCaseRequest(BaseModel):
    contact_request_id: int
    investigator_id: int
    case_name: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None

class InvestigatorUpdate(BaseModel):
    specialization: Optional[str] = None
    years_of_experience: Optional[int] = None
    certification: Optional[str] = None
    department: Optional[str] = None
    is_available: Optional[bool] = None

# =============== DASHBOARD STATS ===============
@router.get("/dashboard/stats")
def get_admin_dashboard_stats(current_user: dict = Depends(require_admin)):
    """Get overview statistics for admin dashboard"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Total users by role - FIXED: Changed 'role' to 'roles'
        cur.execute("""
            SELECT roles, COUNT(*) as count 
            FROM users 
            GROUP BY roles
        """)
        users_by_role_raw = cur.fetchall()
        users_by_role = {row['roles']: row['count'] for row in users_by_role_raw}
        
        # Total cases by status
        cur.execute("""
            SELECT status, COUNT(*) as count 
            FROM cases 
            GROUP BY status
        """)
        cases_by_status_raw = cur.fetchall()
        cases_by_status = {row['status']: row['count'] for row in cases_by_status_raw}
        
        # Contact requests by status
        cur.execute("""
            SELECT status, COUNT(*) as count 
            FROM contact_requests 
            GROUP BY status
        """)
        requests_by_status_raw = cur.fetchall()
        requests_by_status = {row['status']: row['count'] for row in requests_by_status_raw}
        
        # Pending contact requests count
        cur.execute("SELECT COUNT(*) as count FROM contact_requests WHERE status = 'pending'")
        pending_requests = cur.fetchone()['count']
        
        # Active investigators - FIXED: Changed 'role' to 'roles'
        cur.execute("SELECT COUNT(*) as count FROM users WHERE roles = 'investigator' AND is_available = true")
        active_investigators = cur.fetchone()['count']
        
        # Recent activity (last 7 days)
        cur.execute("""
            SELECT COUNT(*) as count 
            FROM cases 
            WHERE created_at >= NOW() - INTERVAL '7 days'
        """)
        recent_cases = cur.fetchone()['count']

        # Pending investigators count
        cur.execute("SELECT COUNT(*) as count FROM users WHERE roles = 'investigator' AND is_approved IS NULL")
        pending_investigators = cur.fetchone()['count']
        
        cur.close()
        conn.close()
        
        return {
            "users_by_role": users_by_role,
            "cases_by_status": cases_by_status,
            "requests_by_status": requests_by_status,
            "pending_requests": pending_requests,
            "active_investigators": active_investigators,
            "recent_cases": recent_cases,
            "total_users": sum(users_by_role.values()),
            "total_cases": sum(cases_by_status.values()),
            "total_requests": sum(requests_by_status.values()),
             "pending_investigators": pending_investigators
        }
    except Exception as e:
        cur.close()
        conn.close()
        logger.exception("Error fetching admin dashboard stats")
        raise HTTPException(status_code=500, detail=str(e))

# =============== CONTACT REQUESTS MANAGEMENT ===============
@router.get("/contact-requests")
def list_contact_requests(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """List all contact requests with optional filters"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    query = """
        SELECT cr.*, 
               u.name as assigned_investigator_name,
               u.email as assigned_investigator_email
        FROM contact_requests cr
        LEFT JOIN users u ON cr.assigned_to = u.id
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND cr.status = %s"
        params.append(status)
    
    if priority:
        query += " AND cr.priority = %s"
        params.append(priority)
    
    query += " ORDER BY cr.created_at DESC"
    
    cur.execute(query, tuple(params))
    requests = cur.fetchall()
    cur.close()
    conn.close()
    
    return {"contact_requests": requests}

@router.get("/contact-requests/{request_id}")
def get_contact_request(request_id: int, current_user: dict = Depends(require_admin)):
    """Get detailed information about a specific contact request"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT cr.*, 
               u.name as assigned_investigator_name,
               u.email as assigned_investigator_email,
               u.specialization as assigned_investigator_specialization
        FROM contact_requests cr
        LEFT JOIN users u ON cr.assigned_to = u.id
        WHERE cr.id = %s
    """, (request_id,))
    
    request = cur.fetchone()
    cur.close()
    conn.close()
    
    if not request:
        raise HTTPException(status_code=404, detail="Contact request not found")
    
    return {"contact_request": request}

@router.put("/contact-requests/{request_id}")
def update_contact_request(
    request_id: int,
    update_data: ContactRequestUpdate,
    current_user: dict = Depends(require_admin)
):
    """Update a contact request (assign investigator, change status, add notes)"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Check if request exists
        cur.execute("SELECT id FROM contact_requests WHERE id = %s", (request_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Contact request not found")
        
        # Build update query
        update_fields = []
        params = []
        
        if update_data.status is not None:
            update_fields.append("status = %s")
            params.append(update_data.status)
            
            if update_data.status in ['approved', 'rejected']:
                update_fields.append("reviewed_at = %s")
                params.append(datetime.datetime.now())
        
        if update_data.priority is not None:
            update_fields.append("priority = %s")
            params.append(update_data.priority)
        
        if update_data.assigned_to is not None:
            # Verify investigator exists - FIXED: Changed 'role' to 'roles'
            cur.execute("SELECT id, roles FROM users WHERE id = %s", (update_data.assigned_to,))
            investigator = cur.fetchone()
            if not investigator:
                raise HTTPException(status_code=404, detail="Investigator not found")
            if investigator['roles'] not in ['investigator', 'admin']:
                raise HTTPException(status_code=400, detail="User is not an investigator")
            
            update_fields.append("assigned_to = %s")
            params.append(update_data.assigned_to)
        
        if update_data.admin_notes is not None:
            update_fields.append("admin_notes = %s")
            params.append(update_data.admin_notes)
        
        update_fields.append("updated_at = %s")
        params.append(datetime.datetime.now())
        
        params.append(request_id)
        
        query = f"UPDATE contact_requests SET {', '.join(update_fields)} WHERE id = %s RETURNING *"
        cur.execute(query, tuple(params))
        updated_request = cur.fetchone()
        conn.commit()
        
        cur.close()
        conn.close()
        
        return {"contact_request": updated_request, "message": "Contact request updated successfully"}
    
    except HTTPException:
        conn.rollback()
        cur.close()
        conn.close()
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/contact-requests/{request_id}/convert-to-case")
def convert_contact_request_to_case(
    request_id: int,
    convert_data: ConvertToCaseRequest,
    current_user: dict = Depends(require_admin)
):
    """Convert an approved contact request into a case and assign to investigator"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Get contact request
        cur.execute("SELECT * FROM contact_requests WHERE id = %s", (request_id,))
        contact_req = cur.fetchone()
        
        if not contact_req:
            raise HTTPException(status_code=404, detail="Contact request not found")
        
        if contact_req['status'] == 'converted':
            raise HTTPException(status_code=400, detail="Request already converted to case")
        
        # Get investigator - FIXED: Changed 'role' to 'roles'
        cur.execute("SELECT * FROM users WHERE id = %s AND roles IN ('investigator', 'admin')", 
                   (convert_data.investigator_id,))
        investigator = cur.fetchone()
        
        if not investigator:
            raise HTTPException(status_code=404, detail="Investigator not found")
        
        # Create case
        case_name = convert_data.case_name or f"Case: {contact_req['subject']}"
        case_category = convert_data.category or "General Investigation"
        case_priority = convert_data.priority or contact_req['priority']
        
        # ✅ FIX: Assign case to investigator (user_id = investigator_id, not admin)
        cur.execute("""
            INSERT INTO cases (
                name, description, category, priority, client, 
                investigating_officer, user_id, source_contact_request_id, 
                status, acceptance_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            case_name,
            contact_req['message'],
            case_category,
            case_priority,
            contact_req['name'],
            investigator['name'],
            convert_data.investigator_id,  # ✅ Case belongs to investigator
            request_id,
            'Assigned',  # ✅ Status when first assigned
            'pending'    # ✅ Waiting for investigator acceptance
        ))
        new_case = cur.fetchone()
        
        # Copy evidence files to case evidence (also assign to investigator)
        if contact_req.get('evidence_files'):
            for file_path in contact_req['evidence_files']:
                filename = os.path.basename(file_path)
                cur.execute("""
                    INSERT INTO evidence (case_id, filename, filepath, user_id)
                    VALUES (%s, %s, %s, %s)
                """, (new_case['id'], filename, file_path, convert_data.investigator_id))
        
        # Update contact request status
        cur.execute("""
            UPDATE contact_requests 
            SET status = 'converted', 
                converted_to_case_id = %s,
                assigned_to = %s,
                updated_at = %s
            WHERE id = %s
        """, (new_case['id'], convert_data.investigator_id, datetime.datetime.now(), request_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "message": "Contact request converted to case successfully",
            "case": new_case
        }
    
    except HTTPException:
        conn.rollback()
        cur.close()
        conn.close()
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        logger.exception("Error converting contact request to case")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/contact-requests/{request_id}")
def delete_contact_request(request_id: int, current_user: dict = Depends(require_admin)):
    """Delete a contact request"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Get request to delete associated files
        cur.execute("SELECT evidence_files FROM contact_requests WHERE id = %s", (request_id,))
        request = cur.fetchone()
        
        if not request:
            raise HTTPException(status_code=404, detail="Contact request not found")
        
        # Delete associated files
        if request.get('evidence_files'):
            for file_path in request['evidence_files']:
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        logger.warning(f"Failed to delete file {file_path}: {str(e)}")
        
        # Delete request
        cur.execute("DELETE FROM contact_requests WHERE id = %s", (request_id,))
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Contact request deleted successfully"}
    
    except HTTPException:
        conn.rollback()
        cur.close()
        conn.close()
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# =============== INVESTIGATOR MANAGEMENT ===============
@router.get("/investigators")
def list_investigators(current_user: dict = Depends(require_admin)):
    """List all investigators with their current workload"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # FIXED: Changed 'role' to 'roles'
    cur.execute("""
        SELECT 
            u.id, u.name, u.email, u.contact_number,
            u.specialization, u.years_of_experience, u.certification,
            u.department, u.is_available, u.created_at,
            COUNT(DISTINCT c.id) as total_cases,
            COUNT(DISTINCT CASE WHEN c.status IN ('Active', 'In Progress') THEN c.id END) as active_cases,
            COUNT(DISTINCT CASE WHEN c.status = 'Closed' THEN c.id END) as closed_cases
        FROM users u
        LEFT JOIN cases c ON c.user_id = u.id
        WHERE u.roles = 'investigator'
        GROUP BY u.id
        ORDER BY u.name
    """)
    
    investigators = cur.fetchall()
    cur.close()
    conn.close()
    
    return {"investigators": investigators}

@router.get("/investigators/{investigator_id}")
def get_investigator_details(investigator_id: int, current_user: dict = Depends(require_admin)):
    """Get detailed information about an investigator including all their cases"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Get investigator info - FIXED: Changed 'role' to 'roles'
    cur.execute("""
        SELECT id, name, email, contact_number, specialization, 
               years_of_experience, certification, department, 
               is_available, created_at
        FROM users 
        WHERE id = %s AND roles = 'investigator'
    """, (investigator_id,))
    
    investigator = cur.fetchone()
    
    if not investigator:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Investigator not found")
    
    # Get all cases
    cur.execute("""
        SELECT id, name, category, priority, status, client, 
               incident_date, created_at, updated_at
        FROM cases 
        WHERE user_id = %s
        ORDER BY updated_at DESC
    """, (investigator_id,))
    
    cases = cur.fetchall()
    
    # Get statistics
    cur.execute("""
        SELECT 
            COUNT(*) as total_cases,
            COUNT(CASE WHEN status IN ('Active', 'In Progress') THEN 1 END) as active_cases,
            COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closed_cases,
            COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_cases
        FROM cases 
        WHERE user_id = %s
    """, (investigator_id,))
    
    stats = cur.fetchone()
    
    cur.close()
    conn.close()
    
    return {
        "investigator": investigator,
        "cases": cases,
        "statistics": stats
    }

@router.put("/investigators/{investigator_id}")
def update_investigator(
    investigator_id: int,
    update_data: InvestigatorUpdate,
    current_user: dict = Depends(require_admin)
):
    """Update investigator profile and availability"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Check if investigator exists - FIXED: Changed 'role' to 'roles'
        cur.execute("SELECT id FROM users WHERE id = %s AND roles = 'investigator'", (investigator_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Investigator not found")
        
        # Build update query
        update_fields = []
        params = []
        
        if update_data.specialization is not None:
            update_fields.append("specialization = %s")
            params.append(update_data.specialization)
        
        if update_data.years_of_experience is not None:
            update_fields.append("years_of_experience = %s")
            params.append(update_data.years_of_experience)
        
        if update_data.certification is not None:
            update_fields.append("certification = %s")
            params.append(update_data.certification)
        
        if update_data.department is not None:
            update_fields.append("department = %s")
            params.append(update_data.department)
        
        if update_data.is_available is not None:
            update_fields.append("is_available = %s")
            params.append(update_data.is_available)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_fields.append("updated_at = %s")
        params.append(datetime.datetime.now())
        params.append(investigator_id)
        
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s RETURNING *"
        cur.execute(query, tuple(params))
        updated_investigator = cur.fetchone()
        conn.commit()
        
        cur.close()
        conn.close()
        
        return {
            "investigator": updated_investigator,
            "message": "Investigator updated successfully"
        }
    
    except HTTPException:
        conn.rollback()
        cur.close()
        conn.close()
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# # =============== USER MANAGEMENT ===============
# @router.get("/users")
# def list_all_users(
#     role: Optional[str] = None,
#     current_user: dict = Depends(require_admin)
# ):
#     """List all users with optional role filter"""
#     conn = database.get_connection()
#     cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
#     # FIXED: Changed 'role' to 'roles'
#     query = "SELECT id, name, email, contact_number, roles, created_at FROM users WHERE 1=1"
#     params = []
    
#     if role:
#         query += " AND roles = %s"
#         params.append(role)
    
#     query += " ORDER BY created_at DESC"
    
#     cur.execute(query, tuple(params))
#     users = cur.fetchall()
#     cur.close()
#     conn.close()
    
#     return {"users": users}

# @router.put("/users/{user_id}/role")
# def update_user_role(
#     user_id: int,
#     role: str,
#     current_user: dict = Depends(require_admin)
# ):
#     """Update a user's role"""
#     if role not in ['user', 'investigator', 'admin']:
#         raise HTTPException(status_code=400, detail="Invalid role")
    
#     conn = database.get_connection()
#     cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
#     try:
#         # FIXED: Changed 'role' to 'roles'
#         cur.execute("""
#             UPDATE users 
#             SET roles = %s, updated_at = %s 
#             WHERE id = %s 
#             RETURNING id, email, name, roles
#         """, (role, datetime.datetime.now(), user_id))
        
#         updated_user = cur.fetchone()
        
#         if not updated_user:
#             raise HTTPException(status_code=404, detail="User not found")
        
#         conn.commit()
#         cur.close()
#         conn.close()
        
#         return {
#             "user": updated_user,
#             "message": f"User role updated to {role}"
#         }
    
#     except HTTPException:
#         conn.rollback()
#         cur.close()
#         conn.close()
#         raise
#     except Exception as e:
#         conn.rollback()
#         cur.close()
#         conn.close()
#         raise HTTPException(status_code=500, detail=str(e))

# =============== CASES OVERVIEW ===============
@router.get("/cases")
def list_all_cases(
    status: Optional[str] = None,
    investigator_id: Optional[int] = None,
    current_user: dict = Depends(require_admin)
):
    """List all cases across all investigators"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    query = """
        SELECT c.*, u.name as investigator_name, u.email as investigator_email
        FROM cases c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE 1=1
    """
    params = []
    
    if status:
        query += " AND c.status = %s"
        params.append(status)
    
    if investigator_id:
        query += " AND c.user_id = %s"
        params.append(investigator_id)
    
    query += " ORDER BY c.updated_at DESC"
    
    cur.execute(query, tuple(params))
    cases = cur.fetchall()
    cur.close()
    conn.close()
    
    return {"cases": cases}

# Add to admin.py after the existing imports and models

class InvestigatorApprovalRequest(BaseModel):
    is_approved: bool
    reason: Optional[str] = None

# =============== INVESTIGATOR APPROVAL SYSTEM ===============
@router.get("/pending-investigators")
def get_pending_investigators(current_user: dict = Depends(require_admin)):
    """Get list of investigators pending approval"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # FIXED: Changed 'role' to 'roles'
    cur.execute("""
        SELECT id, name, email, contact_number, specialization, 
               years_of_experience, certification, department, 
               created_at
        FROM users 
        WHERE roles = 'investigator' 
        AND is_approved IS NULL
        ORDER BY created_at DESC
    """)
    
    pending_investigators = cur.fetchall()
    cur.close()
    conn.close()
    
    return {"pending_investigators": pending_investigators}

@router.put("/investigators/{investigator_id}/approval")
def update_investigator_approval(
    investigator_id: int,
    approval_data: InvestigatorApprovalRequest,
    current_user: dict = Depends(require_admin)
):
    """Approve or reject an investigator"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Check if investigator exists - FIXED: Changed 'role' to 'roles'
        cur.execute("SELECT id FROM users WHERE id = %s AND roles = 'investigator'", (investigator_id,))
        investigator = cur.fetchone()
        
        if not investigator:
            raise HTTPException(status_code=404, detail="Investigator not found")
        
        # Update approval status
        cur.execute("""
            UPDATE users 
            SET is_approved = %s,
                updated_at = %s
            WHERE id = %s
            RETURNING id, email, name, is_approved, roles
        """, (approval_data.is_approved, datetime.datetime.now(), investigator_id))
        
        updated_investigator = cur.fetchone()
        
        # Log the approval/rejection
        cur.execute("""
            INSERT INTO approval_logs 
            (user_id, admin_id, action, reason, created_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            investigator_id,
            current_user['id'],
            'approved' if approval_data.is_approved else 'rejected',
            approval_data.reason,
            datetime.datetime.now()
        ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        action = "approved" if approval_data.is_approved else "rejected"
        return {
            "investigator": updated_investigator,
            "message": f"Investigator {action} successfully"
        }
    
    except HTTPException:
        conn.rollback()
        cur.close()
        conn.close()
        raise
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        logger.exception("Error updating investigator approval")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/investigators/{investigator_id}/approval-history")
def get_investigator_approval_history(
    investigator_id: int,
    current_user: dict = Depends(require_admin)
):
    """Get approval history for an investigator"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT al.*, u.name as admin_name, u.email as admin_email
        FROM approval_logs al
        LEFT JOIN users u ON al.admin_id = u.id
        WHERE al.user_id = %s
        ORDER BY al.created_at DESC
    """, (investigator_id,))
    
    history = cur.fetchall()
    cur.close()
    conn.close()
    
    return {"approval_history": history}

