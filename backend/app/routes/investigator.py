# Add these routes to your FastAPI application
# Create a new file: app/routes/investigator.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import psycopg2.extras
import datetime
import database
from app.routes.auth import get_current_user

router = APIRouter(prefix="/investigator", tags=["Investigator"])

# Pydantic models
class AvailabilityUpdate(BaseModel):
    is_available: bool

# Update investigator availability
@router.put("/availability")
def update_investigator_availability(
    availability_data: AvailabilityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update the availability status of the logged-in investigator"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Update the user's availability status
        cur.execute("""
            UPDATE users 
            SET is_available = %s, updated_at = %s
            WHERE id = %s
            RETURNING id, email, name, is_available
        """, (availability_data.is_available, datetime.datetime.now(), current_user['id']))
        
        updated_user = cur.fetchone()
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "message": "Availability updated successfully",
            "is_available": updated_user['is_available']
        }
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to update availability: {str(e)}")

class NotificationSettings(BaseModel):
    email_notifications: bool

@router.put("/notification-settings")
def update_notification_settings(
    settings: NotificationSettings,
    current_user: dict = Depends(get_current_user)
):
    """Toggle email notifications on/off"""
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        cur.execute("""
            UPDATE users 
            SET email_notifications = %s, updated_at = %s
            WHERE id = %s
            RETURNING id, email, name, email_notifications
        """, (settings.email_notifications, datetime.datetime.now(), current_user['id']))
        
        updated_user = cur.fetchone()
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            "message": "Notification settings updated successfully",
            "email_notifications": updated_user['email_notifications']
        }
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")