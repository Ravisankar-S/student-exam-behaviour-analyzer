from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User, AuthProviderEnum, RoleEnum
from app.models.student_profile import StudentProfile
from app.models.admission_request import AdmissionRequest, AdmissionStatusEnum
from app.core.security import hash_password, verify_password, create_access_token
import uuid

def register_user(db: Session, name: str, email: str, password: Optional[str], role: str, reg_no: Optional[str] = None):
    if role == RoleEnum.admin.value:
        raise ValueError("Admin signup is disabled")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")

    normalized_reg_no = reg_no.strip() if reg_no else None
    if role == RoleEnum.student.value and not normalized_reg_no:
        raise ValueError("Registration number is required for students")

    if normalized_reg_no:
        duplicate_reg = db.query(StudentProfile).filter(StudentProfile.reg_no == normalized_reg_no).first()
        if duplicate_reg:
            raise ValueError("Registration number already in use")

    if role != RoleEnum.student.value and not password:
        raise ValueError("Password is required")

    password_to_hash = password if password else f"pending-{uuid.uuid4().hex}"

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password_to_hash),
        role=role,
        auth_provider=AuthProviderEnum.local
    )

    db.add(user)
    db.flush()

    if role == RoleEnum.student.value:
        profile = StudentProfile(
            user_id=user.id,
            reg_no=normalized_reg_no,
        )
        db.add(profile)
        request = AdmissionRequest(
            student_user_id=user.id,
            student_name=name,
            student_email=email,
            reg_no=normalized_reg_no,
            status=AdmissionStatusEnum.pending,
        )
        db.add(request)

    db.commit()
    db.refresh(user)

    return user


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None

    if user.role == RoleEnum.student:
        admission = db.query(AdmissionRequest).filter(AdmissionRequest.student_user_id == user.id).first()
        if admission and admission.status != AdmissionStatusEnum.approved:
            return None

    if not verify_password(password, user.password_hash):
        return None

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role
    })

    return token


def change_user_password(db: Session, user: User, current_password: str, new_password: str):
    if user.auth_provider != AuthProviderEnum.local:
        raise ValueError("Password change is only available for local accounts")

    if not user.password_hash or not verify_password(current_password, user.password_hash):
        raise ValueError("Current password is incorrect")

    user.password_hash = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return True