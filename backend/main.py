# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.staticfiles import StaticFiles

# Import your routers
from app.routes.cases import router as cases_router
from app.routes.auth import router as auth_router  
from app.routes.settings import router as settings_router
from app.routes.analysis import router as analysis_router
from app.routes.admin import router as admin_router  
from app.routes.contact import router as contact_router
from app.routes.investigator import router as investigator_router

app = FastAPI(title="ForenVision Backend")

# ✅ CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FIX: Register all API routers with the /api/v1 prefix for consistency ---
app.include_router(cases_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(analysis_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1") 
app.include_router(contact_router, prefix="/api/v1")
app.include_router(investigator_router, prefix="/api/v1")

# ✅ Static files (kept separate from /api/v1)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_FOLDER), name="uploads")

@app.get("/")
def root():
    return {"message": "ForenVision API running successfully 🚀"}