from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import bcrypt
import jwt as pyjwt
import datetime
import psycopg2.extras
import database
import logging

# Setup logger
logger = logging.getLogger("forenvision.auth")
logging.basicConfig(level=logging.INFO)

# --- CONFIG ---
SECRET_KEY = "supersecretkey"  # Use environment variable in production
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
    role: Optional[str] = "investigator"  # Default changed to 'investigator', only 'investigator' or 'admin' allowed
    
    # Investigator-specific fields
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
    """
    Dependency to get current user from JWT token
    ✅ FIXED: Properly handles 'role' from JWT and 'roles' from database
    """
    try:
        token = credentials.credentials
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        user_id = payload.get("user_id")
        email = payload.get("email")
        role = payload.get("role")  # ✅ Get role from JWT
        name = payload.get("name")
        
        if user_id is None:
            logger.warning(f"Invalid token: missing user_id")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        # Verify user still exists in database
        conn = database.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, email, name, roles, is_approved FROM users WHERE id = %s", (user_id,))
        db_user = cur.fetchone()
        cur.close()
        conn.close()
        
        if not db_user:
            logger.warning(f"User {user_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # ✅ FIXED: Return user dict with consistent 'role' field
        user_dict = {
            "id": db_user["id"],
            "email": db_user["email"],
            "name": db_user["name"],
            "role": db_user["roles"],  # Database has 'roles', return as 'role'
            "is_approved": db_user.get("is_approved")
        }
        
        logger.info(f"Authenticated user {user_id} with role: {user_dict['role']}, approved: {user_dict['is_approved']}")
        return user_dict
        
    except pyjwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except pyjwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.exception(f"Unexpected error in get_current_user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )


# --- SIGNUP with Approval System ---
@router.post("/signup")
def signup(user: UserCreate):
    """
    Register a new user (investigator or admin only)
    - For investigators: is_approved set to NULL initially (pending approval)
    - For admins: is_approved set to TRUE automatically
    """
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Validate role - only investigator or admin allowed
        if user.role not in ['investigator', 'admin']:
            raise HTTPException(
                status_code=400, 
                detail="Invalid role. Must be 'investigator' or 'admin'"
            )
        
        # Check if user exists
        cur.execute("SELECT * FROM users WHERE email = %s", (user.email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="User already exists")

        # Hash password
        hashed_pw = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt()).decode()

        # Validate investigator fields
        if user.role == 'investigator' and not user.specialization:
            raise HTTPException(
                status_code=400, 
                detail="Specialization is required for investigators"
            )

        # Set approval status
        # - Investigators: NULL initially (pending approval)
        # - Admins: TRUE automatically
        is_approved_value = None if user.role == 'investigator' else True

        # Insert user with all fields (using 'roles' column name)
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
                user.email, 
                hashed_pw, 
                user.name, 
                user.contact_number, 
                user.role,  # This goes into 'roles' column
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
        
        logger.info(f"New user created: {new_user['email']} with role: {new_user['roles']}, approved: {new_user['is_approved']}")

        # Prepare response message based on approval status
        if user.role == 'investigator':
            message = "Your investigator account has been created successfully! Your account is pending admin approval. You'll receive an email notification once approved. Until then, you won't be able to access the dashboard."
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
                "role": new_user["roles"],  # Return from 'roles' column
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
        conn.close()


# --- LOGIN with Approval Check ---
@router.post("/login")
def login(user: UserLogin):
    """
    Authenticate user and return JWT token with role information
    ✅ FIXED: Properly reads 'roles' from database and creates JWT with 'role'
    ✅ ADDED: Check investigator approval status before allowing login
    """
    conn = database.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # ✅ Get user with all fields including 'roles' and 'is_approved'
        cur.execute(
            "SELECT id, email, name, password, roles, is_approved, specialization, years_of_experience, certification, department, is_available FROM users WHERE email = %s", 
            (user.email,)
        )
        db_user = cur.fetchone()

        # Validate credentials
        if not db_user:
            logger.warning(f"Login attempt with non-existent email: {user.email}")
            raise HTTPException(
                status_code=400, 
                detail="Invalid email or password"
            )
            
        if not bcrypt.checkpw(user.password.encode("utf-8"), db_user["password"].encode("utf-8")):
            logger.warning(f"Failed login attempt for: {user.email}")
            raise HTTPException(
                status_code=400, 
                detail="Invalid email or password"
            )

        # Check if user has a role assigned
        if not db_user.get("roles"):
            logger.error(f"User {user.email} has no role assigned")
            raise HTTPException(
                status_code=403,
                detail="Your account is missing a role assignment. Please contact support."
            )

        # ✅ CHECK INVESTIGATOR APPROVAL STATUS
        if db_user["roles"] == "investigator":
            is_approved = db_user.get("is_approved")
            
            if is_approved is False:
                logger.warning(f"Rejected investigator attempted login: {user.email}")
                raise HTTPException(
                    status_code=403,
                    detail="Your account has been rejected by admin. Please contact support."
                )
            
            if is_approved is None:
                logger.warning(f"Pending investigator attempted login: {user.email}")
                raise HTTPException(
                    status_code=403,
                    detail="Your account is pending admin approval. You'll receive an email notification once approved. Until then, you won't be able to access the dashboard."
                )

        # ✅ FIXED: Create JWT token with 'role' field (from database 'roles' column)
        payload = {
            "user_id": db_user["id"],
            "email": db_user["email"],
            "name": db_user.get("name"),
            "role": db_user["roles"],  # ✅ Database 'roles' → JWT 'role'
            "is_approved": db_user.get("is_approved"),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
        }
        token = pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

        # Build user response
        user_response = {
            "id": db_user["id"], 
            "email": db_user["email"],
            "name": db_user.get("name"),
            "role": db_user["roles"],  # ✅ Return as 'role'
            "is_approved": db_user.get("is_approved")
        }

        # Add investigator-specific data if role is investigator
        if db_user["roles"] == "investigator":
            user_response["investigator_profile"] = {
                "specialization": db_user.get("specialization"),
                "years_of_experience": db_user.get("years_of_experience"),
                "certification": db_user.get("certification"),
                "department": db_user.get("department"),
                "is_available": db_user.get("is_available", True)
            }

        logger.info(f"Successful login for user: {user.email} with role: {db_user['roles']}, approved: {db_user.get('is_approved')}")

        return {
            "user": user_response, 
            "token": token,
            "message": "Login successful"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


# --- GET CURRENT USER ---
@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information
    """
    return current_user


# --- LOGOUT (Optional - client-side token removal) ---
@router.post("/logout")
def logout():
    """
    Logout endpoint (token should be removed on client-side)
    """
    return {"message": "Logout successful. Please remove token from client."}