from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
import os
import datetime
import psycopg2.extras
import json  # ✅ Add this import
import database
import logging

router = APIRouter(prefix="/contact", tags=["Contact"])
logger = logging.getLogger(__name__)

CONTACT_UPLOADS = "uploads/contact_requests"
os.makedirs(CONTACT_UPLOADS, exist_ok=True)

@router.post("/submit")
async def submit_contact_request(
    name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    subject: str = Form(...),
    message: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    """
    Submit a contact request from landing page.
    Users can upload evidence files along with their request.
    """
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        # Save uploaded files
        evidence_files = []
        if files:
            for file in files:
                if file.filename:
                    timestamp = int(datetime.datetime.utcnow().timestamp())
                    filename = f"contact_{timestamp}_{file.filename}"
                    filepath = os.path.join(CONTACT_UPLOADS, filename)
                    
                    with open(filepath, "wb") as f:
                        content = await file.read()
                        f.write(content)
                    
                    evidence_files.append(filepath)
        
        logger.info(f"Contact request from {email}, {len(evidence_files)} files uploaded")
        
        # ✅ Convert Python list to JSON string for JSONB column
        evidence_files_json = json.dumps(evidence_files)
        
        # Insert contact request
        cur.execute("""
            INSERT INTO contact_requests 
            (name, email, phone, subject, message, evidence_files, status, priority)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            RETURNING *
        """, (
            name,
            email,
            phone,
            subject,
            message,
            evidence_files_json,  # ✅ Pass as JSON string with ::jsonb cast
            'pending',
            'medium'
        ))
        
        new_request = cur.fetchone()
        conn.commit()
        
        logger.info(f"Contact request created: ID {new_request['id']}")
        
        return {
            "message": "Contact request submitted successfully. Our team will review it shortly.",
            "request_id": new_request['id'],
            "status": "pending"
        }

    except Exception as e:
        conn.rollback()
        logger.exception("Error submitting contact request")
        raise HTTPException(status_code=500, detail=f"Failed to submit request: {str(e)}")
    finally:
        cur.close()
        conn.close()

@router.get("/status/{request_id}")
def check_request_status(request_id: int, email: str):
    """
    Allow users to check the status of their contact request
    by providing request ID and email for verification
    """
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        cur.execute("""
            SELECT id, name, email, subject, status, priority, created_at, updated_at,
                   admin_notes, assigned_to, converted_to_case_id
            FROM contact_requests
            WHERE id = %s AND email = %s
        """, (request_id, email))

        request = cur.fetchone()

        if not request:
            raise HTTPException(status_code=404, detail="Request not found or email does not match")

        # Get investigator name if assigned
        investigator_name = None
        if request.get('assigned_to'):
            cur.execute("SELECT name FROM users WHERE id = %s", (request['assigned_to'],))
            investigator = cur.fetchone()
            if investigator:
                investigator_name = investigator['name']

        return {
            "request": {
                **request,
                "investigator_name": investigator_name
            }
        }
    finally:
        cur.close()
        conn.close()