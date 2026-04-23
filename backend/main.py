# backend/app/main.py
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.staticfiles import StaticFiles

# ── Routers
from app.routes.cases import router as cases_router
from app.routes.auth import router as auth_router, websocket_auth
from app.routes.settings import router as settings_router
from app.routes.analysis import router as analysis_router
from app.routes.admin import router as admin_router
from app.routes.contact import router as contact_router
from app.routes.investigator import router as investigator_router
from app.routes.report import router as report_router
from app.routes.reconstruction import router as reconstruction_router

app = FastAPI(title="ForenVision Backend")

# ── CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Allows WebSocket upgrade headers
)

# ── API routers
app.include_router(cases_router,          prefix="/api/v1")
app.include_router(auth_router,           prefix="/api/v1")
app.include_router(settings_router,       prefix="/api/v1")
app.include_router(analysis_router,       prefix="/api/v1")
app.include_router(admin_router,          prefix="/api/v1")
app.include_router(contact_router,        prefix="/api/v1")
app.include_router(investigator_router,   prefix="/api/v1")
app.include_router(report_router,         prefix="/api/v1")
app.include_router(reconstruction_router, prefix="/api/v1")

# ── WebSocket
app.add_api_websocket_route("/api/v1/ws/auth", websocket_auth)

# ── Static files
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_FOLDER), name="uploads")

# Serve finished 3-D models (.glb / .obj) so the frontend can download them
MODEL_OUTPUT_FOLDER = os.environ.get(
    "RECONSTRUCTION_OUTPUT_DIR",
    os.path.join("ml", "outputs", "3d_models"),
)
os.makedirs(MODEL_OUTPUT_FOLDER, exist_ok=True)
app.mount("/3d-models", StaticFiles(directory=MODEL_OUTPUT_FOLDER), name="3d_models")

@app.get("/")
def root():
    return {"message": "ForenVision API running successfully"}