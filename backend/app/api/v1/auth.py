from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, ProfileUpdateRequest, ChangePasswordRequest, TestEmailRequest, AdminCreateTeacherRequest
from app.schemas.teacher_profile import TeacherProfileUpdateRequest
from app.services.auth_service import register_user, authenticate_user, change_user_password, generate_initial_password
from app.api.deps import get_db
from app.api.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.teacher_profile import TeacherProfile
from app.models.student_profile import StudentProfile
from app.models.admission_request import AdmissionRequest, AdmissionStatusEnum
from app.models.faculty_request import FacultyRequest, FacultyRequestStatusEnum
from app.core.security import hash_password
from app.core.config import settings
from app.utils.email import send_email, render_template
from app.utils.uploads import save_image_upload, delete_uploaded_file
from datetime import datetime, timezone


router = APIRouter(prefix="/auth", tags=["auth"])


def _to_utc_iso(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat()


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


def _serialize_teacher_user(user: User):
    profile = user.teacher_profile
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "created_at": _to_utc_iso(user.created_at),
        "teacher_profile": {
            "employee_id": profile.employee_id if profile else None,
            "college_email": profile.college_email if profile else None,
            "department": profile.department if profile else None,
            "designation": profile.designation if profile else None,
        },
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
            "created_at": _to_utc_iso(student.created_at),
        }
        for student in students
    ]


@router.get("/teachers")
def list_teachers(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(User).filter(User.role == RoleEnum.teacher)
    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter((User.name.ilike(keyword)) | (User.email.ilike(keyword)))

    teachers = query.order_by(User.created_at.desc()).all()
    return [_serialize_teacher_user(teacher) for teacher in teachers]


@router.post("/teachers", status_code=201)
def create_teacher_account(
    data: AdminCreateTeacherRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    name = data.name.strip()
    college_email = str(data.college_email).strip().lower()
    employee_id = data.employee_id.strip() if data.employee_id else None
    designation = data.designation.strip() if data.designation else None
    department = data.department.strip() if data.department else None

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    existing_user = db.query(User).filter(User.email == college_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="College email already exists as user")

    if employee_id:
        duplicate_employee = db.query(TeacherProfile).filter(TeacherProfile.employee_id == employee_id).first()
        if duplicate_employee:
            raise HTTPException(status_code=400, detail="Employee ID already in use")

    duplicate_college_email = db.query(TeacherProfile).filter(TeacherProfile.college_email == college_email).first()
    if duplicate_college_email:
        raise HTTPException(status_code=400, detail="College email already in use")

    temp_password = generate_initial_password(name)
    user = register_user(
        db,
        name,
        college_email,
        temp_password,
        RoleEnum.teacher.value,
        internal_create=True,
    )

    teacher_profile = db.query(TeacherProfile).filter(TeacherProfile.user_id == user.id).first()
    if not teacher_profile:
        teacher_profile = TeacherProfile(user_id=user.id)
        db.add(teacher_profile)

    teacher_profile.employee_id = employee_id
    teacher_profile.college_email = college_email
    teacher_profile.designation = designation
    teacher_profile.department = department
    db.commit()
    db.refresh(user)

    subject = render_template(settings.FACULTY_APPROVED_SUBJECT, name=user.name)
    body = render_template(
        settings.FACULTY_APPROVED_BODY,
        name=user.name,
        email=college_email,
        password=temp_password,
    )
    send_email(college_email, subject, body)

    return _serialize_teacher_user(user)


def _serialize_admission_request(request: AdmissionRequest):
    return {
        "id": str(request.id),
        "student_user_id": str(request.student_user_id),
        "student_name": request.student_name,
        "student_email": request.student_email,
        "reg_no": request.reg_no,
        "status": request.status,
        "reviewed_by": str(request.reviewed_by) if request.reviewed_by else None,
        "reviewed_at": _to_utc_iso(request.reviewed_at),
        "created_at": _to_utc_iso(request.created_at),
    }


def _serialize_faculty_request(request: FacultyRequest):
    return {
        "id": str(request.id),
        "full_name": request.full_name,
        "email": request.email,
        "department": request.department,
        "year_of_joining": request.year_of_joining,
        "status": request.status,
        "reviewed_by": str(request.reviewed_by) if request.reviewed_by else None,
        "reviewed_at": _to_utc_iso(request.reviewed_at),
        "created_at": _to_utc_iso(request.created_at),
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
    req.reviewed_at = datetime.now(timezone.utc)

    student = db.query(User).filter(User.id == req.student_user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student account not found")

    temp_password = generate_initial_password(student.name)
    student.password_hash = hash_password(temp_password)

    db.commit()
    db.refresh(req)

    subject = render_template(settings.STUDENT_APPROVED_SUBJECT, name=student.name)
    body = render_template(
        settings.STUDENT_APPROVED_BODY,
        name=student.name,
        email=student.email,
        password=temp_password,
    )
    send_email(student.email, subject, body)

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
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return _serialize_admission_request(req)


@router.get("/faculty-requests")
def list_faculty_requests(
    status: str = "pending",
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(FacultyRequest)
    if status in {"pending", "approved", "rejected"}:
        query = query.filter(FacultyRequest.status == status)

    requests = query.order_by(FacultyRequest.created_at.desc()).all()
    return [_serialize_faculty_request(req) for req in requests]


@router.post("/faculty-requests", status_code=201)
def create_faculty_request(
    data: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip()
    department = (data.get("department") or "").strip() or None
    year_of_joining = data.get("year_of_joining")

    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    duplicate_user = db.query(User).filter(User.email == email).first()
    if duplicate_user:
        raise HTTPException(status_code=400, detail="Email already exists as user")

    duplicate_request = db.query(FacultyRequest).filter(FacultyRequest.email == email).first()
    if duplicate_request and duplicate_request.status == FacultyRequestStatusEnum.pending:
        raise HTTPException(status_code=400, detail="Faculty request already pending for this email")

    req = duplicate_request if duplicate_request else FacultyRequest(email=email)
    req.full_name = full_name
    req.department = department
    req.year_of_joining = year_of_joining
    req.status = FacultyRequestStatusEnum.pending
    req.reviewed_by = None
    req.reviewed_at = None

    db.add(req)
    db.commit()
    db.refresh(req)
    return _serialize_faculty_request(req)


@router.post("/faculty-requests/{request_id}/approve")
def approve_faculty_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    req = db.query(FacultyRequest).filter(FacultyRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Faculty request not found")

    if req.status == FacultyRequestStatusEnum.approved:
        return _serialize_faculty_request(req)

    temp_password = generate_initial_password(req.full_name)
    user = register_user(
        db,
        req.full_name,
        req.email,
        temp_password,
        RoleEnum.teacher.value,
        internal_create=True,
    )

    teacher_profile = db.query(TeacherProfile).filter(TeacherProfile.user_id == user.id).first()
    if not teacher_profile:
        teacher_profile = TeacherProfile(user_id=user.id)
        db.add(teacher_profile)

    teacher_profile.department = req.department
    teacher_profile.year_of_joining = req.year_of_joining

    req.status = FacultyRequestStatusEnum.approved
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)

    subject = render_template(settings.FACULTY_APPROVED_SUBJECT, name=req.full_name)
    body = render_template(
        settings.FACULTY_APPROVED_BODY,
        name=req.full_name,
        email=req.email,
        password=temp_password,
    )
    send_email(req.email, subject, body)

    return _serialize_faculty_request(req)


@router.post("/faculty-requests/{request_id}/reject")
def reject_faculty_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    req = db.query(FacultyRequest).filter(FacultyRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Faculty request not found")

    req.status = FacultyRequestStatusEnum.rejected
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return _serialize_faculty_request(req)


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
    if data.role != RoleEnum.student.value:
        raise HTTPException(status_code=403, detail="Only student signup is enabled")

    try:
        user = register_user(db, data.name, data.email, data.password, data.role, data.reg_no)

        subject = render_template(settings.STUDENT_SIGNUP_SUBJECT, name=user.name)
        body = render_template(
            settings.STUDENT_SIGNUP_BODY,
            name=user.name,
            email=user.email,
            reg_no=data.reg_no,
        )
        send_email(user.email, subject, body)

        return {"message": "User created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    token = authenticate_user(db, data.email, data.password)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": token}


@router.post("/test-email")
def send_test_email(
    data: TestEmailRequest,
    current_user: User = Depends(require_admin),
):
    to_email = str(data.to_email) if data.to_email else current_user.email
    subject = data.subject or "Argus.ai email provider test"
    body = data.body or render_template(
        "Hello {name},\n\n"
        "This is a test email from Argus.ai.\n"
        "If you received this, email provider configuration is working correctly.\n\n"
        "- Argus.ai",
        name=current_user.name,
    )

    sent = send_email(to_email, subject, body)
    if not sent:
        raise HTTPException(status_code=500, detail="Email send failed. Check email provider settings and server logs.")

    return {
        "message": "Test email sent successfully",
        "to_email": to_email,
    }


