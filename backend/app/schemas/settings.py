# backend/app/schemas/settings.py
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, List
from datetime import datetime

# Profile schemas
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_number: Optional[str] = None

class ProfileResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    contact_number: Optional[str]
    profile_picture: Optional[str]
    two_factor_enabled: bool

    class Config:
        from_attributes = True

# Password change schema
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# 2FA schemas
class TwoFactorSetup(BaseModel):
    enable: bool

class TwoFactorVerify(BaseModel):
    token: str

# Application Settings schemas
class ApplicationSettings(BaseModel):
    language: Optional[str] = 'en'
    theme: Optional[str] = 'system'
    default_date_range: Optional[int] = 7
    hashing_algorithm: Optional[str] = 'sha256'
    file_type_categories: Optional[Dict[str, List[str]]] = None
    keyword_lists: Optional[List[str]] = None
    external_tools: Optional[Dict[str, str]] = None

# Case Management Settings schemas
class CaseManagementSettings(BaseModel):
    case_number_prefix: Optional[str] = 'FV'
    default_classification: Optional[str] = 'confidential'
    default_priority: Optional[str] = 'medium'
    auto_assign_investigator: Optional[bool] = False
    auto_archive_enabled: Optional[bool] = True
    archive_after_days: Optional[int] = 90
    archive_only_closed: Optional[bool] = True
    storage_quota_enabled: Optional[bool] = False
    user_storage_limit: Optional[int] = 1024
    case_storage_limit: Optional[int] = 512
    compression_enabled: Optional[bool] = True
    data_export_format: Optional[str] = 'json'

# Notification Preferences schemas
class NotificationPreferences(BaseModel):
    email_notifications: Optional[bool] = True
    case_updates: Optional[bool] = True
    new_assignments: Optional[bool] = True
    system_announcements: Optional[bool] = False

# Combined settings response
class UserSettingsResponse(BaseModel):
    profile: ProfileResponse
    application: ApplicationSettings
    case_management: CaseManagementSettings
    notifications: NotificationPreferences

    class Config:
        from_attributes = True