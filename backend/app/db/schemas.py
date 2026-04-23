# backend/app/db/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# ── User ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr

    class Config:
        orm_mode = True

# ── Case ─────────────────────────────────────────────────────────────────────

class CaseBase(BaseModel):
    name: str
    description: Optional[str] = None
    incident_date: Optional[datetime] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    client: Optional[str] = None
    investigating_officer: Optional[str] = None

class CaseCreate(CaseBase):
    pass

class CaseUpdate(CaseBase):
    name: Optional[str] = None

class CaseResponse(CaseBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

# ── Evidence ─────────────────────────────────────────────────────────────────

class EvidenceBase(BaseModel):
    filename: str
    filepath: str

class EvidenceCreate(EvidenceBase):
    case_id: int

class EvidenceResponse(EvidenceBase):
    id: int
    case_id: int
    uploaded_at: datetime

    class Config:
        orm_mode = True

# ── Witness Statement ─────────────────────────────────────────────────────────

class WitnessStatementBase(BaseModel):
    witness_name: str
    statement: str
    contact_info: Optional[str] = None
    statement_date: Optional[datetime] = None

class WitnessStatementCreate(WitnessStatementBase):
    case_id: int

class WitnessStatementUpdate(WitnessStatementBase):
    witness_name: Optional[str] = None
    statement: Optional[str] = None

class WitnessStatementResponse(WitnessStatementBase):
    id: int
    case_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

# ── Reconstruction ────────────────────────────────────────────────────────────

class ReconstructionStartRequest(BaseModel):
    """Body sent by the frontend to kick off a job."""
    case_id: int
    image_filename: str   # just the filename, e.g. "knife.png"
    image_filepath: str   # path the server can actually read, e.g. "uploads/knife.png"

class ReconstructionJobResponse(BaseModel):
    """Returned on job creation and on status polls."""
    id: int
    case_id: int
    image_filename: str
    status: str           # pending | running | done | failed
    progress: int         # 0-100
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class ReconstructionJobListResponse(BaseModel):
    """All jobs for a given case."""
    jobs: List[ReconstructionJobResponse]