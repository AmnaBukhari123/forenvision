from fastapi import APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
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

load_dotenv()
# Setup logger
logger = logging.getLogger("forenvision.auth")
logging.basicConfig(level=logging.INFO)

# --- CONFIG ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
security = HTTPBearer()

# --- ROUTER ---
router = APIRouter(prefix="/auth", tags=["Auth"])

# --- MODELS ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    contact_number: Optional[str] = None
    role: Optional[str] = "investigator"
    specialization: Optional[str] = None
    years_of_experience: Optional[int] = None
    certification: Optional[str] = None
    department: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str
    is_approved: Optional[bool] = None

# --- AUTHENTICATION MIDDLEWARE ---
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        user_id = payload.get("user_id")
        email = payload.get("email")
        role = payload.get("role")
        name = payload.get("name")
        
        if user_id is None:
            logger.warning(f"Invalid token: missing user_id")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        conn = database.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, email, name, roles, is_approved FROM users WHERE id = %s", (user_id,))
        db_user = cur.fetchone()
        cur.close()
        database.release_connection(conn)  # ← release here, not get again
        
        if not db_user:
            logger.warning(f"User {user_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        user_dict = {
            "id": db_user["id"],
            "email": db_user["email"],
            "name": db_user["name"],
            "role": db_user["roles"],
            "is_approved": db_user.get("is_approved")
        }
        
        logger.info(f"Authenticated user {user_id} with role: {user_dict['role']}")
        return user_dict
        
    except pyjwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except pyjwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except Exception as e:
        logger.exception(f"Unexpected error in get_current_user: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Authentication error")


# --- SIGNUP ---
@router.post("/signup")
def signup(user: UserCreate):
    conn = database.get_connection()
    cur = conn.cursor()

    try:
        if user.role not in ['investigator', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid role. Must be 'investigator' or 'admin'")
        
        cur.execute("SELECT * FROM users WHERE email = %s", (user.email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="User already exists")

        hashed_pw = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt()).decode()

        if user.role == 'investigator' and not user.specialization:
            raise HTTPException(status_code=400, detail="Specialization is required for investigators")

        is_approved_value = None if user.role == 'investigator' else True

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
                user.email, hashed_pw, user.name, user.contact_number, user.role,
                user.specialization if user.role == 'investigator' else None,
                user.years_of_experience if user.role == 'investigator' else None,
                user.certification if user.role == 'investigator' else None,
                user.department if user.role == 'investigator' else None,
                True if user.role == 'investigator' else None,
                is_approved_value
            ),
        )
        new_user = cur.fetchone()
        conn.commit()

        if user.role == 'investigator':
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
        raise
    except Exception as e:
        conn.rollback()
        logger.exception(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        database.release_connection(conn)  # ← correct



# --- REST LOGIN (keep for backward compatibility) ---
@router.post("/login")
def login(user: UserLogin):
    conn = database.get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "SELECT id, email, name, password, roles, is_approved, specialization, years_of_experience, certification, department, is_available FROM users WHERE email = %s",
            (user.email,)
        )
        db_user = cur.fetchone()

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

        payload = {
            "user_id": db_user["id"],
            "email": db_user["email"],
            "name": db_user.get("name"),
            "role": db_user["roles"],
            "is_approved": db_user.get("is_approved"),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
        }
        token = pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

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
        cur.close()
        database.release_connection(conn)  # ← correct



# ── NEW: WebSocket login endpoint ──────────────────────────────────────────────
async def websocket_auth(websocket: WebSocket):
    await websocket.accept()

    async def send_event(event: str, payload: dict):
        await websocket.send_text(json.dumps({"event": event, **payload}))

    try:
        # Send a ready signal so the frontend knows the socket is alive
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
                email    = data.get("email", "").strip().lower()
                password = data.get("password", "")

                await send_event("status", {"message": "Checking credentials..."})

                try:
                    conn = database.get_connection()
                    cur  = conn.cursor()

                    cur.execute(
                        "SELECT id, email, name, password, roles, is_approved FROM users WHERE email = %s",
                        (email,)
                    )
                    db_user = cur.fetchone()

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
                        "email":   db_user["email"],
                        "name":    db_user.get("name"),
                        "role":    db_user["roles"],
                        "is_approved": db_user.get("is_approved"),
                        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
                    }
                    token = pyjwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)

                    await send_event("login_success", {
                        "message": "Login successful!",
                        "token": token,
                        "role":  db_user["roles"],
                        "user": {
                            "id":    db_user["id"],
                            "email": db_user["email"],
                            "name":  db_user.get("name"),
                            "role":  db_user["roles"],
                        }
                    })

                except Exception as db_err:
                    logger.exception(f"DB error during login: {db_err}")
                    await send_event("error", {"message": "Database error. Please try again."})

                finally:
                    try:
                        cur.close()
                        database.release_connection(conn)  # ← correct

                    except:
                        pass

    except WebSocketDisconnect:
        logger.info("Client disconnected from ws/auth")
    except Exception as top_err:
        logger.exception(f"WebSocket top-level error: {top_err}")  # ← real error prints here


# --- GET CURRENT USER ---
@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


# --- LOGOUT ---
@router.post("/logout")
def logout():
    return {"message": "Logout successful. Please remove token from client."}