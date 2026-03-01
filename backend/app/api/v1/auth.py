from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse
from app.services.auth_service import register_user, authenticate_user
from app.api.deps import get_db
from app.api.deps import get_current_user
from app.models.user import User


router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "auth_provider": current_user.auth_provider,
    }

@router.post("/signup")
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    try:
        user = register_user(
            db,
            data.name,
            data.email,
            data.password,
            data.role
        )
        return {"message": "User created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    token = authenticate_user(db, data.email, data.password)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"access_token": token}

