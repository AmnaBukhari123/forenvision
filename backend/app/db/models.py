from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON, Boolean, Enum
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    INVESTIGATOR = "investigator"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    name = Column(String, nullable=True)
    contact_number = Column(String, nullable=True)
    profile_picture = Column(String, nullable=True)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String, nullable=True)
    roles = Column(String, default='investigator', nullable=False)
    
    # Investigator-specific fields
    specialization = Column(String, nullable=True)
    years_of_experience = Column(Integer, nullable=True)
    certification = Column(String, nullable=True)
    department = Column(String, nullable=True)
    is_available = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ContactRequest(Base):
    __tablename__ = "contact_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    evidence_files = Column(JSON, default=[])
    status = Column(String, default='pending')
    priority = Column(String, default='medium')
    
    # Assignment tracking
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_investigator = relationship("User", foreign_keys=[assigned_to])
    
    # Conversion tracking
    converted_to_case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Application Settings
    language = Column(String, default='en')
    theme = Column(String, default='system')
    default_date_range = Column(Integer, default=7)
    
    # Analysis Configuration
    hashing_algorithm = Column(String, default='sha256')
    file_type_categories = Column(JSON, default={
        'documents': ['.pdf', '.doc', '.docx', '.txt'],
        'images': ['.jpg', '.jpeg', '.png', '.gif'],
        'videos': ['.mp4', '.avi', '.mov'],
        'scripts': ['.ps1', '.bat', '.sh', '.py']
    })
    keyword_lists = Column(JSON, default=['Credit Card Patterns', 'SSN Patterns', 'Confidential Terms'])
    external_tools = Column(JSON, default={
        'volatility': '',
        'autopsy': '',
        'other': ''
    })
    
    # Case Management Settings
    case_number_prefix = Column(String, default='FV')
    default_classification = Column(String, default='confidential')
    default_priority = Column(String, default='medium')
    auto_assign_investigator = Column(Boolean, default=False)
    auto_archive_enabled = Column(Boolean, default=True)
    archive_after_days = Column(Integer, default=90)
    archive_only_closed = Column(Boolean, default=True)
    
    # Data & Storage Settings
    storage_quota_enabled = Column(Boolean, default=False)
    user_storage_limit = Column(Integer, default=1024)
    compression_enabled = Column(Boolean, default=True)
    data_export_format = Column(String, default='json')
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User")

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    incident_date = Column(DateTime)
    category = Column(String)
    priority = Column(String)
    client = Column(String)
    investigating_officer = Column(String)
    status = Column(String, default='New')
    
    # ✅ ADDED: Case acceptance workflow fields
    acceptance_status = Column(String, default='pending', nullable=True)  # 'pending', 'accepted', 'declined'
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", foreign_keys=[user_id])
    
    # Track if case originated from contact request
    source_contact_request_id = Column(Integer, ForeignKey("contact_requests.id"), nullable=True)

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    filename = Column(String)
    filepath = Column(String)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User")