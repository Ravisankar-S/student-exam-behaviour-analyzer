from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, ProfileUpdateRequest, ChangePasswordRequest
from app.schemas.teacher_profile import TeacherProfileUpdateRequest
from app.services.auth_service import register_user, authenticate_user, change_user_password
from app.api.deps import get_db
from app.api.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.teacher_profile import TeacherProfile
from app.models.student_profile import StudentProfile
from app.models.admission_request import AdmissionRequest, AdmissionStatusEnum
from app.utils.uploads import save_image_upload, delete_uploaded_file
from datetime import datetime


router = APIRouter(prefix="/auth", tags=["auth"])


def require_teacher_or_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in (RoleEnum.teacher, RoleEnum.admin):
        raise HTTPException(status_code=403, detail="Teacher or admin access required")
    return current_user


def require_teacher(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.teacher:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _serialize_teacher_profile(profile: TeacherProfile):
    return {
        "user_id": str(profile.user_id),
        "employee_id": profile.employee_id,
        "college_email": profile.college_email,
        "department": profile.department,
        "designation": profile.designation,
        "subjects": profile.subjects,
        "office_room": profile.office_room,
        "year_of_joining": profile.year_of_joining,
    }


@router.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "auth_provider": current_user.auth_provider,
        "profile_picture_path": current_user.profile_picture_path,
    }


@router.patch("/profile")
def update_profile(
    data: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name is not None:
        current_user.name = data.name
    if data.email is not None:
        existing = db.query(User).filter(
            User.email == data.email,
            User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = str(data.email)
    db.commit()
    db.refresh(current_user)
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "auth_provider": current_user.auth_provider,
        "profile_picture_path": current_user.profile_picture_path,
    }


@router.post("/profile-picture")
def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old_path = current_user.profile_picture_path
    path = save_image_upload(file, "profiles")
    current_user.profile_picture_path = path
    db.commit()
    db.refresh(current_user)
    delete_uploaded_file(old_path)
    return {
        "profile_picture_path": current_user.profile_picture_path,
    }


@router.delete("/profile-picture")
def delete_profile_picture(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old_path = current_user.profile_picture_path
    current_user.profile_picture_path = None
    db.commit()
    db.refresh(current_user)
    delete_uploaded_file(old_path)
    return {
        "profile_picture_path": current_user.profile_picture_path,
    }


@router.patch("/password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    try:
        change_user_password(db, current_user, data.current_password, data.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"message": "Password updated successfully"}


@router.get("/students")
def list_students(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin),
):
    query = db.query(User).filter(User.role == RoleEnum.student)
    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter((User.name.ilike(keyword)) | (User.email.ilike(keyword)))

    students = query.order_by(User.name.asc()).all()
    return [
        {
            "id": str(student.id),
            "name": student.name,
            "email": student.email,
            "reg_no": student.student_profile.reg_no if student.student_profile else None,
            "created_at": student.created_at.isoformat() if student.created_at else None,
        }
        for student in students
    ]


def _serialize_admission_request(request: AdmissionRequest):
    return {
        "id": str(request.id),
        "student_user_id": str(request.student_user_id),
        "student_name": request.student_name,
        "student_email": request.student_email,
        "reg_no": request.reg_no,
        "status": request.status,
        "reviewed_by": str(request.reviewed_by) if request.reviewed_by else None,
        "reviewed_at": request.reviewed_at.isoformat() if request.reviewed_at else None,
        "created_at": request.created_at.isoformat() if request.created_at else None,
    }


@router.get("/admission-requests")
def list_admission_requests(
    status: str = "pending",
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(AdmissionRequest)
    if status in {"pending", "approved", "rejected"}:
        query = query.filter(AdmissionRequest.status == status)

    requests = query.order_by(AdmissionRequest.created_at.desc()).all()
    return [_serialize_admission_request(req) for req in requests]


@router.post("/admission-requests/{student_user_id}/approve")
def approve_admission_request(
    student_user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    req = db.query(AdmissionRequest).filter(AdmissionRequest.student_user_id == student_user_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Admission request not found")

    req.status = AdmissionStatusEnum.approved
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return _serialize_admission_request(req)


@router.post("/admission-requests/{student_user_id}/reject")
def reject_admission_request(
    student_user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    req = db.query(AdmissionRequest).filter(AdmissionRequest.student_user_id == student_user_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Admission request not found")

    req.status = AdmissionStatusEnum.rejected
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return _serialize_admission_request(req)


@router.get("/teacher-profile")
def get_teacher_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    profile = db.query(TeacherProfile).filter(TeacherProfile.user_id == current_user.id).first()
    if not profile:
        profile = TeacherProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return _serialize_teacher_profile(profile)


@router.patch("/teacher-profile")
def update_teacher_profile(
    data: TeacherProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    profile = db.query(TeacherProfile).filter(TeacherProfile.user_id == current_user.id).first()
    if not profile:
        profile = TeacherProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()

    if data.employee_id is not None:
        employee_id = data.employee_id.strip() or None
        if employee_id:
            duplicate = db.query(TeacherProfile).filter(
                TeacherProfile.employee_id == employee_id,
                TeacherProfile.user_id != current_user.id,
            ).first()
            if duplicate:
                raise HTTPException(status_code=400, detail="Employee ID already in use")
        profile.employee_id = employee_id

    if data.college_email is not None:
        college_email = data.college_email.strip() or None
        if college_email:
            duplicate_email = db.query(TeacherProfile).filter(
                TeacherProfile.college_email == college_email,
                TeacherProfile.user_id != current_user.id,
            ).first()
            if duplicate_email:
                raise HTTPException(status_code=400, detail="College email already in use")
        profile.college_email = college_email

    if data.department is not None:
        profile.department = data.department.strip() or None
    if data.designation is not None:
        profile.designation = data.designation.strip() or None
    if data.subjects is not None:
        profile.subjects = data.subjects.strip() or None
    if data.office_room is not None:
        profile.office_room = data.office_room.strip() or None
    if data.year_of_joining is not None:
        profile.year_of_joining = data.year_of_joining

    db.commit()
    db.refresh(profile)
    return _serialize_teacher_profile(profile)


@router.post("/signup")
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    if data.role == RoleEnum.admin.value:
        raise HTTPException(status_code=403, detail="Admin signup is disabled")

    try:
        register_user(db, data.name, data.email, data.password, data.role, data.reg_no)
        return {"message": "User created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    token = authenticate_user(db, data.email, data.password)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": token}


