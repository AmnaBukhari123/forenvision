from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# User Schemas
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

# Case Schemas
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

# Evidence Schemas
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