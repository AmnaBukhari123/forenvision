# backend/app/routes/settings.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
import bcrypt
import pyotp
from database import get_connection
import psycopg2.extras
import datetime
import shutil
import os
import json  # ADD THIS IMPORT
from app.routes.auth import get_current_user
from app.schemas.settings import (
    ProfileUpdate, ProfileResponse, PasswordChange, TwoFactorSetup, 
    TwoFactorVerify, ApplicationSettings, CaseManagementSettings, 
    UserSettingsResponse, NotificationPreferences  # ADD THIS
)


router = APIRouter(prefix="/settings", tags=["Settings"])

# Profile picture upload directory
PROFILE_PICTURES_DIR = "uploads/profile_pictures"
os.makedirs(PROFILE_PICTURES_DIR, exist_ok=True)

# === Profile Settings ===
@router.get("/profile", response_model=ProfileResponse)
def get_profile(current_user: dict = Depends(get_current_user)):
    """Get user profile information"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        cur.execute("""
            SELECT id, email, name, contact_number, profile_picture, two_factor_enabled 
            FROM users WHERE id = %s
        """, (current_user["id"],))
        user = cur.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return user
    finally:
        cur.close()
        conn.close()

@router.put("/profile", response_model=ProfileResponse)
def update_profile(profile_update: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update user profile information"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Build update query dynamically
        update_fields = []
        params = []
        
        if profile_update.name is not None:
            update_fields.append("name = %s")
            params.append(profile_update.name)
        if profile_update.email is not None:
            # Check if email already exists (for other users)
            cur.execute("SELECT id FROM users WHERE email = %s AND id != %s", 
                       (profile_update.email, current_user["id"]))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Email already exists")
            update_fields.append("email = %s")
            params.append(profile_update.email)
        if profile_update.contact_number is not None:
            update_fields.append("contact_number = %s")
            params.append(profile_update.contact_number)
            
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
            
        params.append(current_user["id"])
        
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s RETURNING id, email, name, contact_number, profile_picture, two_factor_enabled"
        cur.execute(query, tuple(params))
        updated_user = cur.fetchone()
        conn.commit()
        
        return updated_user
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@router.post("/profile/picture")
async def upload_profile_picture(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload profile picture"""
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and GIF images are allowed")
    
    # Validate file size (max 5MB)
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()  # Get position (file size)
    file.file.seek(0)  # Reset to beginning
    
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"user_{current_user['id']}_{int(datetime.datetime.now().timestamp())}{file_extension}"
    file_path = os.path.join(PROFILE_PICTURES_DIR, filename)
    
    try:
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Update user profile picture in database
        conn = get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Delete old profile picture if exists
        cur.execute("SELECT profile_picture FROM users WHERE id = %s", (current_user["id"],))
        old_picture = cur.fetchone()
        if old_picture and old_picture["profile_picture"]:
            old_file_path = os.path.join(PROFILE_PICTURES_DIR, old_picture["profile_picture"])
            if os.path.exists(old_file_path):
                os.remove(old_file_path)
        
        # Update with new picture
        cur.execute("UPDATE users SET profile_picture = %s WHERE id = %s RETURNING id, email, name, contact_number, profile_picture, two_factor_enabled", 
                   (filename, current_user["id"]))
        updated_user = cur.fetchone()
        conn.commit()
        
        return updated_user
    except Exception as e:
        # Clean up file if database update fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        file.file.close()
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

# === Password Management ===
@router.post("/password")
def change_password(password_change: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change user password"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Get current password hash
        cur.execute("SELECT password FROM users WHERE id = %s", (current_user["id"],))
        user = cur.fetchone()
        
        if not user or not bcrypt.checkpw(password_change.current_password.encode('utf-8'), user["password"].encode('utf-8')):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Hash new password
        new_hashed_password = bcrypt.hashpw(password_change.new_password.encode('utf-8'), bcrypt.gensalt()).decode()
        
        # Update password
        cur.execute("UPDATE users SET password = %s WHERE id = %s", 
                   (new_hashed_password, current_user["id"]))
        conn.commit()
        
        return {"message": "Password updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# === Two-Factor Authentication ===
@router.post("/2fa/setup")
def setup_2fa(twofa_setup: TwoFactorSetup, current_user: dict = Depends(get_current_user)):
    """Enable or disable two-factor authentication"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        if twofa_setup.enable:
            # Generate new secret for 2FA
            secret = pyotp.random_base32()
            cur.execute("UPDATE users SET two_factor_enabled = %s, two_factor_secret = %s WHERE id = %s",
                       (True, secret, current_user["id"]))
            
            # Generate provisioning URI for QR code
            totp = pyotp.TOTP(secret)
            provisioning_uri = totp.provisioning_uri(current_user["email"], issuer_name="Forenvision")
            
            conn.commit()
            return {
                "message": "2FA enabled successfully", 
                "secret": secret,
                "provisioning_uri": provisioning_uri
            }
        else:
            cur.execute("UPDATE users SET two_factor_enabled = %s, two_factor_secret = %s WHERE id = %s",
                       (False, None, current_user["id"]))
            conn.commit()
            return {"message": "2FA disabled successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@router.post("/2fa/verify")
def verify_2fa(twofa_verify: TwoFactorVerify, current_user: dict = Depends(get_current_user)):
    """Verify 2FA token during setup"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        cur.execute("SELECT two_factor_secret FROM users WHERE id = %s", (current_user["id"],))
        user = cur.fetchone()
        
        if not user or not user["two_factor_secret"]:
            raise HTTPException(status_code=400, detail="2FA not set up")
        
        totp = pyotp.TOTP(user["two_factor_secret"])
        if not totp.verify(twofa_verify.token):
            raise HTTPException(status_code=400, detail="Invalid token")
        
        return {"message": "2FA verified successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# === Application Settings ===
@router.get("/application", response_model=ApplicationSettings)
def get_application_settings(current_user: dict = Depends(get_current_user)):
    """Get user's application settings"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        settings = _get_or_create_user_settings(cur, current_user["id"])
        conn.commit()  # Commit if new settings were created
        return ApplicationSettings(**settings)
    finally:
        cur.close()
        conn.close()

@router.put("/application", response_model=ApplicationSettings)
def update_application_settings(settings: ApplicationSettings, current_user: dict = Depends(get_current_user)):
    """Update user's application settings"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        _get_or_create_user_settings(cur, current_user["id"])
        
        # Convert Pydantic model to dict
        update_data = settings.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No settings to update")
        
        # Convert dict/list fields to JSON strings for PostgreSQL
        for key, value in update_data.items():
            if isinstance(value, (dict, list)):
                update_data[key] = json.dumps(value)
        
        set_clause = ", ".join([f"{key} = %s" for key in update_data.keys()])
        values = list(update_data.values()) + [current_user["id"]]
        
        query = f"UPDATE user_settings SET {set_clause} WHERE user_id = %s RETURNING *"
        cur.execute(query, tuple(values))
        updated_settings = cur.fetchone()
        conn.commit()
        
        return ApplicationSettings(**updated_settings)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"Error updating application settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# === Case Management Settings ===
@router.get("/case-management", response_model=CaseManagementSettings)
def get_case_management_settings(current_user: dict = Depends(get_current_user)):
    """Get user's case management settings"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        settings = _get_or_create_user_settings(cur, current_user["id"])
        conn.commit()  # Commit if new settings were created
        return CaseManagementSettings(**settings)
    finally:
        cur.close()
        conn.close()

@router.put("/case-management", response_model=CaseManagementSettings)
def update_case_management_settings(settings: CaseManagementSettings, current_user: dict = Depends(get_current_user)):
    """Update user's case management settings"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        _get_or_create_user_settings(cur, current_user["id"])
        
        # Convert Pydantic model to dict
        update_data = settings.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No settings to update")
        
        # No JSON conversion needed for case management settings (all primitives)
        set_clause = ", ".join([f"{key} = %s" for key in update_data.keys()])
        values = list(update_data.values()) + [current_user["id"]]
        
        query = f"UPDATE user_settings SET {set_clause} WHERE user_id = %s RETURNING *"
        cur.execute(query, tuple(values))
        updated_settings = cur.fetchone()
        conn.commit()
        
        return CaseManagementSettings(**updated_settings)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"Error updating case management settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# === All Settings ===
@router.get("/all", response_model=UserSettingsResponse)
def get_all_settings(current_user: dict = Depends(get_current_user)):
    """Get all user settings in one response"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Get profile
        cur.execute("SELECT id, email, name, contact_number, profile_picture, two_factor_enabled FROM users WHERE id = %s", 
                   (current_user["id"],))
        profile = cur.fetchone()
        
        # Get settings
        settings = _get_or_create_user_settings(cur, current_user["id"])
        conn.commit()  # Commit if new settings were created
        
        return UserSettingsResponse(
            profile=ProfileResponse(**profile),
            application=ApplicationSettings(**settings),
            case_management=CaseManagementSettings(**settings)
        )
    finally:
        cur.close()
        conn.close()

# Helper function
def _get_or_create_user_settings(cur, user_id):
    """Get user settings or create default if they don't exist"""
    cur.execute("SELECT * FROM user_settings WHERE user_id = %s", (user_id,))
    settings = cur.fetchone()
    
    if not settings:
        # Create default settings with JSON-encoded values
        default_file_types = json.dumps({
            'documents': ['.pdf', '.doc', '.docx', '.txt'],
            'images': ['.jpg', '.jpeg', '.png', '.gif'],
            'videos': ['.mp4', '.avi', '.mov'],
            'scripts': ['.ps1', '.bat', '.sh', '.py']
        })
        default_keywords = json.dumps(['Credit Card Patterns', 'SSN Patterns', 'Confidential Terms'])
        default_tools = json.dumps({
            'volatility': '',
            'autopsy': '',
            'other': ''
        })
        
        cur.execute("""
            INSERT INTO user_settings (
                user_id, 
                file_type_categories, 
                keyword_lists, 
                external_tools
            ) VALUES (%s, %s, %s, %s) 
            RETURNING *
        """, (user_id, default_file_types, default_keywords, default_tools))
        settings = cur.fetchone()
    
    return settings

# === Notification Preferences ===
@router.get("/notifications", response_model=NotificationPreferences)
def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Get user's notification preferences"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        settings = _get_or_create_user_settings(cur, current_user["id"])
        conn.commit()
        return NotificationPreferences(**settings)
    finally:
        cur.close()
        conn.close()

@router.put("/notifications", response_model=NotificationPreferences)
def update_notification_preferences(
    preferences: NotificationPreferences, 
    current_user: dict = Depends(get_current_user)
):
    """Update user's notification preferences"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        _get_or_create_user_settings(cur, current_user["id"])
        
        update_data = preferences.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No preferences to update")
        
        set_clause = ", ".join([f"{key} = %s" for key in update_data.keys()])
        values = list(update_data.values()) + [current_user["id"]]
        
        query = f"UPDATE user_settings SET {set_clause} WHERE user_id = %s RETURNING *"
        cur.execute(query, tuple(values))
        updated_settings = cur.fetchone()
        conn.commit()
        
        return NotificationPreferences(**updated_settings)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"Error updating notification preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

# Update the get_all_settings route to include notifications:
@router.get("/all", response_model=UserSettingsResponse)
def get_all_settings(current_user: dict = Depends(get_current_user)):
    """Get all user settings in one response"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Get profile
        cur.execute(
            "SELECT id, email, name, contact_number, profile_picture, two_factor_enabled FROM users WHERE id = %s", 
            (current_user["id"],)
        )
        profile = cur.fetchone()
        
        # Get settings
        settings = _get_or_create_user_settings(cur, current_user["id"])
        conn.commit()
        
        return UserSettingsResponse(
            profile=ProfileResponse(**profile),
            application=ApplicationSettings(**settings),
            case_management=CaseManagementSettings(**settings),
            notifications=NotificationPreferences(**settings)  # ADD THIS
        )
    finally:
        cur.close()
        conn.close()