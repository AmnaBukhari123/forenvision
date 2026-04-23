# models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    JSON,
    Boolean,
    Enum as SAEnum,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, declarative_base
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

    roles = Column(String, default="investigator", nullable=False)

    # Investigator-specific fields
    specialization = Column(String, nullable=True)
    years_of_experience = Column(Integer, nullable=True)
    certification = Column(String, nullable=True)
    department = Column(String, nullable=True)
    is_available = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # relationships
    cases = relationship("Case", back_populates="user")
    evidences = relationship("Evidence", back_populates="user")
    witness_statements = relationship("WitnessStatement", back_populates="user")

    def __repr__(self):
        return f"<User id={self.id} email={self.email} roles={self.roles}>"


class ContactRequest(Base):
    __tablename__ = "contact_requests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)

    evidence_files = Column(JSON, default=list)
    status = Column(String, default="pending")
    priority = Column(String, default="medium")

    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_investigator = relationship("User", foreign_keys=[assigned_to])

    converted_to_case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    converted_case = relationship("Case", foreign_keys=[converted_to_case_id])

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ContactRequest id={self.id} name={self.name} status={self.status}>"


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    language = Column(String, default="en")
    theme = Column(String, default="system")
    default_date_range = Column(Integer, default=7)

    hashing_algorithm = Column(String, default="sha256")
    file_type_categories = Column(
        JSON,
        default=lambda: {
            "documents": [".pdf", ".doc", ".docx", ".txt"],
            "images": [".jpg", ".jpeg", ".png", ".gif"],
            "videos": [".mp4", ".avi", ".mov"],
            "scripts": [".ps1", ".bat", ".sh", ".py"],
        },
    )
    keyword_lists = Column(JSON, default=lambda: ["Credit Card Patterns", "SSN Patterns", "Confidential Terms"])
    external_tools = Column(JSON, default=lambda: {"volatility": "", "autopsy": "", "other": ""})

    case_number_prefix = Column(String, default="FV")
    default_classification = Column(String, default="confidential")
    default_priority = Column(String, default="medium")
    auto_assign_investigator = Column(Boolean, default=False)
    auto_archive_enabled = Column(Boolean, default=True)
    archive_after_days = Column(Integer, default=90)
    archive_only_closed = Column(Boolean, default=True)

    storage_quota_enabled = Column(Boolean, default=False)
    user_storage_limit = Column(Integer, default=1024)
    compression_enabled = Column(Boolean, default=True)
    data_export_format = Column(String, default="json")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User")

    def __repr__(self):
        return f"<UserSettings id={self.id} user_id={self.user_id}>"


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
    status = Column(String, default="New")

    acceptance_status = Column(String, default="pending", nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", foreign_keys=[user_id], back_populates="cases")

    source_contact_request_id = Column(Integer, ForeignKey("contact_requests.id"), nullable=True)
    source_contact_request = relationship("ContactRequest", foreign_keys=[source_contact_request_id])

    evidences = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    witness_statements = relationship("WitnessStatement", back_populates="case", cascade="all, delete-orphan")

    # Reconstruction jobs for this case
    reconstruction_jobs = relationship("ReconstructionJob", back_populates="case", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Case id={self.id} name={self.name} status={self.status}>"


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    filename = Column(String)
    filepath = Column(String)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="evidences")

    case = relationship("Case", back_populates="evidences")

    def __repr__(self):
        return f"<Evidence id={self.id} filename={self.filename} case_id={self.case_id}>"


class WitnessStatement(Base):
    __tablename__ = "witness_statements"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    witness_name = Column(String, nullable=False)
    statement = Column(Text, nullable=False)
    contact_info = Column(String, nullable=True)
    statement_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="witness_statements")

    case = relationship("Case", back_populates="witness_statements")

    def __repr__(self):
        return f"<WitnessStatement id={self.id} witness_name={self.witness_name} case_id={self.case_id}>"


# Reconstruction Job
class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class ReconstructionJob(Base):
    """Tracks a single TripoSR 3-D reconstruction job for one evidence image."""

    __tablename__ = "reconstruction_jobs"

    id = Column(Integer, primary_key=True, index=True)

    # Which case and which image file this job belongs to
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    image_filename = Column(String, nullable=False)   # e.g. "knife.png"
    image_filepath = Column(String, nullable=False)   # absolute/relative path used by runner

    # Job lifecycle
    status = Column(String, default=JobStatus.PENDING, nullable=False)
    progress = Column(Integer, default=0, nullable=False)  # 0-100
    error_message = Column(Text, nullable=True)

    # Where the output .glb / .obj ends up (set when status = done)
    output_path = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    case = relationship("Case", back_populates="reconstruction_jobs")

    def __repr__(self):
        return (
            f"<ReconstructionJob id={self.id} case_id={self.case_id} "
            f"image={self.image_filename} status={self.status} progress={self.progress}>"
        )