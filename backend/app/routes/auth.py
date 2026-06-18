from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    status,
    WebSocket,
    WebSocketDisconnect,
    Form,
    File,
    UploadFile,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from typing import Optional
import bcrypt
import jwt as pyjwt
import datetime
import psycopg2.extras
import database
import logging
import json
import os
import re
import uuid

load_dotenv()
logger = logging.getLogger("forenvision.auth")
logging.basicConfig(level=logging.INFO)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
security = HTTPBearer()

router = APIRouter(prefix="/auth", tags=["Auth"])

# Where uploaded certification files get stored. Adjust to match your
# existing static/media setup (e.g. swap for S3/GCS upload logic).
CERTIFICATION_UPLOAD_DIR = os.getenv("CERTIFICATION_UPLOAD_DIR", "uploads/certifications")
os.makedirs(CERTIFICATION_UPLOAD_DIR, exist_ok=True)

ALLOWED_CERT_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_CERT_FILE_SIZE = 10 * 1024 * 1024  # 10MB

NAME_PATTERN = re.compile(r"^[A-Za-z\s]+$")
ALPHANUMERIC_PUNCT_PATTERN = re.compile(r"^[A-Za-z0-9\s.,&'()-]+$")
PHONE_CHARS_PATTERN = re.compile(r"^[0-9+\-\s]*$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str
    is_approved: Optional[bool] = None


# ── AUTHENTICATION MIDDLEWARE ──────────────────────────────────────────────────
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    conn = None  # always declare before try so finally can check it safely
    try:
        token = credentials.credentials
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = payload.get("user_id")
        if user_id is None:
            logger.warning("Invalid token: missing user_id")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )

        conn = database.get_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT id, email, name, roles, is_approved FROM users WHERE id = %s",
                (user_id,)
            )
            db_user = cur.fetchone()
        finally:
            cur.close()  # always close cursor regardless

        if not db_user:
            logger.warning(f"User {user_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        return {
            "id": db_user["id"],
            "email": db_user["email"],
            "name": db_user["name"],
            "role": db_user["roles"],
            "is_approved": db_user.get("is_approved")
        }

    except pyjwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except pyjwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except HTTPException:
        raise  # re-raise cleanly, don't wrap in 500
    except Exception as e:
        logger.exception(f"Unexpected error in get_current_user: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Authentication error")
    finally:
        if conn is not None:
            database.release_connection(conn)  # ALWAYS runs, no matter what


# ── SIGNUP ─────────────────────────────────────────────────────────────────────
# Switched from a JSON body (Pydantic UserCreate model) to multipart/form-data
# so the investigator's certification can be uploaded as an actual file
# alongside the rest of the signup fields. Form(...) fields mirror the old
# UserCreate model; certification is now File(...) and required for
# investigators (validated below), optional/ignored for admins.
@router.post("/signup")
def signup(
    email: EmailStr = Form(...),
    password: str = Form(...),
    name: Optional[str] = Form(None),
    contact_number: Optional[str] = Form(None),
    role: str = Form("investigator"),
    specialization: Optional[str] = Form(None),
    years_of_experience: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    certification: Optional[UploadFile] = File(None),
):
    conn = None
    saved_cert_path = None
    try:
        if role not in ["investigator", "admin"]:
            raise HTTPException(status_code=400, detail="Invalid role. Must be 'investigator' or 'admin'")

        if name and not NAME_PATTERN.match(name.strip()):
            raise HTTPException(status_code=400, detail="Name can only contain letters and spaces")

        if contact_number and not PHONE_CHARS_PATTERN.match(contact_number):
            raise HTTPException(status_code=400, detail="Phone number can only contain numbers, spaces, dashes, and +")

        parsed_years = None
        if role == "investigator":
            if not specialization or not specialization.strip():
                raise HTTPException(status_code=400, detail="Specialization is required for investigators")
            if not ALPHANUMERIC_PUNCT_PATTERN.match(specialization.strip()):
                raise HTTPException(status_code=400, detail="Specialization can only contain letters, numbers, spaces, and basic punctuation")

            if department and not ALPHANUMERIC_PUNCT_PATTERN.match(department.strip()):
                raise HTTPException(status_code=400, detail="Department can only contain letters, numbers, spaces, and basic punctuation")

            if years_of_experience not in (None, ""):
                try:
                    parsed_years = int(years_of_experience)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Years of experience must be a whole number")
                if parsed_years < 0 or parsed_years > 50:
                    raise HTTPException(status_code=400, detail="Years of experience must be between 0 and 50")

            if certification is None or not certification.filename:
                raise HTTPException(status_code=400, detail="Certification file is required for investigators")
            if certification.content_type not in ALLOWED_CERT_CONTENT_TYPES:
                raise HTTPException(status_code=400, detail="Certification file must be a PDF, PNG, or JPEG")

        # Persist the certification file to disk (swap this block for your
        # object-storage upload logic if you're not storing on local disk).
        certification_path = None
        if role == "investigator" and certification is not None:
            file_bytes = certification.file.read()
            if len(file_bytes) > MAX_CERT_FILE_SIZE:
                raise HTTPException(status_code=400, detail="Certification file must be smaller than 10MB")

            ext = os.path.splitext(certification.filename)[1]
            safe_filename = f"{uuid.uuid4().hex}{ext}"
            certification_path = os.path.join(CERTIFICATION_UPLOAD_DIR, safe_filename)
            with open(certification_path, "wb") as f:
                f.write(file_bytes)
            saved_cert_path = certification_path  # tracked so we can clean up on failure

        conn = database.get_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="User already exists")

            hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()

            is_approved_value = None if role == "investigator" else True

            cur.execute(
                """
                INSERT INTO users (
                    email, password, name, contact_number, roles,
                    specialization, years_of_experience, certification,
                    department, is_available, is_approved
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, email, name, roles, is_approved
                """,
                (
                    email, hashed_pw, name, contact_number, role,
                    specialization if role == "investigator" else None,
                    parsed_years if role == "investigator" else None,
                    certification_path if role == "investigator" else None,
                    department if role == "investigator" else None,
                    True if role == "investigator" else None,
                    is_approved_value
                ),
            )
            new_user = cur.fetchone()
            conn.commit()
        finally:
            cur.close()

        if role == "investigator":
            message = "Your investigator account has been created successfully! Pending admin approval."
            requires_approval = True
        else:
            message = "Admin account created successfully!"
            requires_approval = False

        return {
            "message": message,
            "requires_approval": requires_approval,
            "user": {
                "id": new_user["id"],
                "email": new_user["email"],
                "name": new_user["name"],
                "role": new_user["roles"],
                "is_approved": new_user["is_approved"]
            }
        }

    except HTTPException:
        if conn:
            conn.rollback()
        # Clean up the uploaded file if signup failed after it was saved
        if saved_cert_path and os.path.exists(saved_cert_path):
            try:
                os.remove(saved_cert_path)
            except OSError:
                logger.warning(f"Failed to clean up orphaned certification file: {saved_cert_path}")
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        if saved_cert_path and os.path.exists(saved_cert_path):
            try:
                os.remove(saved_cert_path)
            except OSError:
                logger.warning(f"Failed to clean up orphaned certification file: {saved_cert_path}")
        logger.exception(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn is not None:
            database.release_connection(conn)


# ── LOGIN ──────────────────────────────────────────────────────────────────────
@router.post("/login")
def login(user: UserLogin):
    conn = None
    try:
        conn = database.get_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                """SELECT id, email, name, password, roles, is_approved,
                          specialization, years_of_experience, certification,
                          department, is_available
                   FROM users WHERE email = %s""",
                (user.email,)
            )
            db_user = cur.fetchone()
        finally:
            cur.close()

        if not db_user:
            raise HTTPException(status_code=400, detail="Invalid email or password")

        if not bcrypt.checkpw(user.password.encode("utf-8"), db_user["password"].encode("utf-8")):
            raise HTTPException(status_code=400, detail="Invalid email or password")

        if not db_user.get("roles"):
            raise HTTPException(status_code=403, detail="Your account is missing a role assignment.")

        if db_user["roles"] == "investigator":
            is_approved = db_user.get("is_approved")
            if is_approved is False:
                raise HTTPException(status_code=403, detail="Your account has been rejected by admin.")
            if is_approved is None:
                raise HTTPException(status_code=403, detail="Your account is pending admin approval.")

        token_payload = {
            "user_id": db_user["id"],
            "email": db_user["email"],
            "name": db_user.get("name"),
            "role": db_user["roles"],
            "is_approved": db_user.get("is_approved"),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
        }
        token = pyjwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)

        user_response = {
            "id": db_user["id"],
            "email": db_user["email"],
            "name": db_user.get("name"),
            "role": db_user["roles"],
            "is_approved": db_user.get("is_approved")
        }

        if db_user["roles"] == "investigator":
            user_response["investigator_profile"] = {
                "specialization": db_user.get("specialization"),
                "years_of_experience": db_user.get("years_of_experience"),
                "certification": db_user.get("certification"),
                "department": db_user.get("department"),
                "is_available": db_user.get("is_available", True)
            }

        return {"user": user_response, "token": token, "message": "Login successful"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn is not None:
            database.release_connection(conn)


# ── WEBSOCKET LOGIN ────────────────────────────────────────────────────────────
async def websocket_auth(websocket: WebSocket):
    await websocket.accept()

    async def send_event(event: str, payload: dict):
        await websocket.send_text(json.dumps({"event": event, **payload}))

    try:
        await send_event("ready", {"message": "Connected"})

        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await send_event("error", {"message": "Invalid JSON"})
                continue

            action = data.get("action")

            if action == "login":
                email = data.get("email", "").strip().lower()
                password = data.get("password", "")

                await send_event("status", {"message": "Checking credentials..."})

                conn = None
                try:
                    conn = database.get_connection()
                    cur = conn.cursor()
                    try:
                        cur.execute(
                            "SELECT id, email, name, password, roles, is_approved FROM users WHERE email = %s",
                            (email,)
                        )
                        db_user = cur.fetchone()
                    finally:
                        cur.close()

                    if not db_user or not bcrypt.checkpw(
                        password.encode("utf-8"),
                        db_user["password"].encode("utf-8")
                    ):
                        await send_event("login_failed", {"message": "Invalid email or password"})
                        continue

                    if db_user["roles"] == "investigator":
                        is_approved = db_user.get("is_approved")
                        if is_approved is None:
                            await send_event("account_pending", {
                                "message": "Your account is pending admin approval."
                            })
                            continue
                        if is_approved is False:
                            await send_event("account_rejected", {
                                "message": "Your account has been rejected. Contact support."
                            })
                            continue

                    token_payload = {
                        "user_id": db_user["id"],
                        "email": db_user["email"],
                        "name": db_user.get("name"),
                        "role": db_user["roles"],
                        "is_approved": db_user.get("is_approved"),
                        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
                    }
                    token = pyjwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)

                    await send_event("login_success", {
                        "message": "Login successful!",
                        "token": token,
                        "role": db_user["roles"],
                        "user": {
                            "id": db_user["id"],
                            "email": db_user["email"],
                            "name": db_user.get("name"),
                            "role": db_user["roles"],
                        }
                    })

                except Exception as db_err:
                    logger.exception(f"DB error during WS login: {db_err}")
                    await send_event("error", {"message": "Database error. Please try again."})
                finally:
                    if conn is not None:
                        database.release_connection(conn)  # always runs

    except WebSocketDisconnect:
        logger.info("Client disconnected from ws/auth")
    except Exception as top_err:
        logger.exception(f"WebSocket top-level error: {top_err}")


# ── ME / LOGOUT ────────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout():
    return {"message": "Logout successful. Please remove token from client."}