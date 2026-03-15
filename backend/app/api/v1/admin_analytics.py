from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional
from datetime import date, datetime, time
from collections import defaultdict

from app.api.deps import get_db, get_current_user
from app.models.user import User, RoleEnum
from app.models.student_profile import StudentProfile
from app.models.teacher_profile import TeacherProfile
from app.models.assessment import Assessment
from app.models.attempt import Attempt
from app.models.question import Question

router = APIRouter(prefix="/admin/analytics", tags=["admin-analytics"])

FAIL_THRESHOLD = 40.0


def require_admin(current_user: User = Depends(get_current_user)):
    role = current_user.role
    role_value = role.value if hasattr(role, "value") else str(role)
    if role_value != RoleEnum.admin.value:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _attempt_duration_seconds(attempt: Attempt) -> Optional[int]:
    if not attempt.started_at or not attempt.submitted_at:
        return None
    diff = (attempt.submitted_at - attempt.started_at).total_seconds()
    return int(diff) if diff >= 0 else None


def _derive_behavior_label(attempt: Attempt, exam_duration_minutes: Optional[int]) -> str:
    score = float(attempt.score or 0)
    duration = _attempt_duration_seconds(attempt)
    exam_seconds = int((exam_duration_minutes or 60) * 60)

    if duration is None:
        return "Deliberative"

    if duration <= max(120, int(exam_seconds * 0.3)) and score >= 70:
        return "Fast_Response"
    if duration <= max(90, int(exam_seconds * 0.2)) and score < 40:
        return "Disengaged"
    if duration >= int(exam_seconds * 0.85):
        return "Deliberative"
    return "High_Revision"


@router.get("/overview")
def get_platform_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    total_students = db.query(User).filter(User.role == RoleEnum.student).count()
    total_teachers = db.query(User).filter(User.role == RoleEnum.teacher).count()
    total_exams = db.query(Assessment).count()
    total_attempts = db.query(Attempt).count()

    avg_score = db.query(func.avg(Attempt.score)).filter(Attempt.score.isnot(None)).scalar()

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_exams": total_exams,
        "total_attempts": total_attempts,
        "average_platform_score": round(float(avg_score), 2) if avg_score is not None else None,
    }


@router.get("/students-directory")
def get_students_directory(
    q: Optional[str] = Query(default=None, max_length=100),
    reg_no: Optional[str] = Query(default=None, max_length=100),
    department: Optional[str] = Query(default=None, max_length=100),
    semester: Optional[int] = Query(default=None, ge=1, le=12),
    division: Optional[str] = Query(default=None, max_length=20),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    base = db.query(User).join(StudentProfile, StudentProfile.user_id == User.id).filter(User.role == RoleEnum.student)

    if q and q.strip():
        keyword = f"%{q.strip()}%"
        base = base.filter((User.name.ilike(keyword)) | (User.email.ilike(keyword)))

    if reg_no and reg_no.strip():
        base = base.filter(StudentProfile.reg_no.ilike(f"%{reg_no.strip()}%"))

    if department and department.strip():
        base = base.filter(StudentProfile.department.ilike(department.strip()))

    if semester is not None:
        base = base.filter(StudentProfile.semester == semester)

    if division and division.strip():
        base = base.filter(StudentProfile.division.ilike(division.strip()))

    total = base.count()

    rows = (
        base
        .outerjoin(Attempt, Attempt.student_id == User.id)
        .with_entities(
            User.id,
            User.name,
            User.email,
            StudentProfile.reg_no,
            StudentProfile.department,
            StudentProfile.semester,
            StudentProfile.division,
            func.count(Attempt.id).label("exams_taken"),
            func.avg(Attempt.score).label("avg_score"),
        )
        .group_by(
            User.id,
            User.name,
            User.email,
            StudentProfile.reg_no,
            StudentProfile.department,
            StudentProfile.semester,
            StudentProfile.division,
        )
        .order_by(User.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        {
            "student_id": str(row.id),
            "name": row.name,
            "email": row.email,
            "reg_no": row.reg_no,
            "department": row.department,
            "semester": row.semester,
            "division": row.division,
            "exams_taken": int(row.exams_taken or 0),
            "avg_score": round(float(row.avg_score), 2) if row.avg_score is not None else None,
        }
        for row in rows
    ]

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }


@router.get("/teachers-directory")
def get_teachers_directory(
    q: Optional[str] = Query(default=None, max_length=100),
    department: Optional[str] = Query(default=None, max_length=100),
    subject: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    base = db.query(User).join(TeacherProfile, TeacherProfile.user_id == User.id).filter(User.role == RoleEnum.teacher)

    if q and q.strip():
        keyword = f"%{q.strip()}%"
        base = base.filter((User.name.ilike(keyword)) | (User.email.ilike(keyword)))

    if department and department.strip():
        base = base.filter(TeacherProfile.department.ilike(department.strip()))

    if subject and subject.strip():
        subject_exists = db.query(Assessment.id).filter(
            Assessment.created_by == User.id,
            Assessment.subject.ilike(subject.strip()),
        ).exists()
        base = base.filter(subject_exists)

    total = base.count()

    rows = (
        base
        .outerjoin(Assessment, Assessment.created_by == User.id)
        .outerjoin(Attempt, Attempt.assessment_id == Assessment.id)
        .with_entities(
            User.id,
            User.name,
            User.email,
            TeacherProfile.department,
            func.count(func.distinct(Assessment.id)).label("exams_created"),
            func.count(Attempt.id).label("total_attempts"),
            func.avg(Attempt.score).label("avg_score"),
        )
        .group_by(User.id, User.name, User.email, TeacherProfile.department)
        .order_by(User.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        {
            "teacher_id": str(row.id),
            "name": row.name,
            "email": row.email,
            "department": row.department,
            "exams_created": int(row.exams_created or 0),
            "total_attempts": int(row.total_attempts or 0),
            "avg_score": round(float(row.avg_score), 2) if row.avg_score is not None else None,
        }
        for row in rows
    ]

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }


@router.get("/failure-rate")
def get_failure_rate_monitoring(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = (
        db.query(
            Assessment.id,
            Assessment.title,
            Assessment.subject,
            User.name.label("teacher_name"),
            func.count(Attempt.id).label("attempts"),
            func.sum(case((Attempt.score < FAIL_THRESHOLD, 1), else_=0)).label("failed_attempts"),
        )
        .join(User, User.id == Assessment.created_by)
        .outerjoin(Attempt, Attempt.assessment_id == Assessment.id)
        .group_by(Assessment.id, Assessment.title, Assessment.subject, User.name)
        .order_by(Assessment.created_at.desc())
    )

    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for row in rows:
        attempts = int(row.attempts or 0)
        failed = int(row.failed_attempts or 0)
        failure_rate = round((failed / attempts) * 100, 2) if attempts > 0 else 0.0
        items.append({
            "assessment_id": str(row.id),
            "exam": row.title,
            "subject": row.subject,
            "teacher": row.teacher_name,
            "attempts": attempts,
            "failure_rate": failure_rate,
            "flagged": failure_rate > 70,
        })

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }


@router.get("/students/{student_id}/history")
def get_student_exam_history(
    student_id: str,
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    subject: Optional[str] = Query(default=None, max_length=100),
    teacher_id: Optional[str] = Query(default=None, max_length=100),
    assessment_id: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    student = db.query(User).filter(User.id == student_id, User.role == RoleEnum.student).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    query = (
        db.query(Attempt, Assessment, User)
        .join(Assessment, Attempt.assessment_id == Assessment.id)
        .join(User, User.id == Assessment.created_by)
        .filter(Attempt.student_id == student.id)
    )

    if start_date is not None:
        start_dt = datetime.combine(start_date, time.min)
        query = query.filter(Attempt.started_at >= start_dt)

    if end_date is not None:
        end_dt = datetime.combine(end_date, time.max)
        query = query.filter(Attempt.started_at <= end_dt)

    if subject and subject.strip():
        query = query.filter(Assessment.subject.ilike(subject.strip()))

    if teacher_id and teacher_id.strip():
        query = query.filter(Assessment.created_by == teacher_id.strip())

    if assessment_id and assessment_id.strip():
        query = query.filter(Assessment.id == assessment_id.strip())

    total = query.count()

    rows = (
        query
        .order_by(Attempt.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for attempt, assessment, teacher in rows:
        behavior = _derive_behavior_label(attempt, assessment.duration_minutes)
        items.append({
            "attempt_id": str(attempt.id),
            "exam_id": str(assessment.id),
            "exam": assessment.title,
            "subject": assessment.subject,
            "teacher_id": str(teacher.id),
            "teacher": teacher.name,
            "score": attempt.score,
            "date": attempt.started_at.isoformat() if attempt.started_at else None,
            "duration_seconds": _attempt_duration_seconds(attempt),
            "behaviour_label": behavior,
        })

    all_rows = (
        db.query(Assessment.id, Assessment.title, Assessment.subject, User.id, User.name)
        .join(Attempt, Attempt.assessment_id == Assessment.id)
        .join(User, User.id == Assessment.created_by)
        .filter(Attempt.student_id == student.id)
        .all()
    )

    subject_options = sorted({row.subject for row in all_rows if row.subject})
    teacher_options = sorted(
        [{"id": str(row[3]), "name": row[4]} for row in all_rows],
        key=lambda item: item["name"],
    )
    dedup_teachers = []
    seen_teacher_ids = set()
    for teacher in teacher_options:
        if teacher["id"] in seen_teacher_ids:
            continue
        seen_teacher_ids.add(teacher["id"])
        dedup_teachers.append(teacher)

    exam_options = sorted(
        [{"id": str(row[0]), "title": row[1]} for row in all_rows],
        key=lambda item: item["title"],
    )
    dedup_exams = []
    seen_exam_ids = set()
    for exam in exam_options:
        if exam["id"] in seen_exam_ids:
            continue
        seen_exam_ids.add(exam["id"])
        dedup_exams.append(exam)

    return {
        "student": {
            "id": str(student.id),
            "name": student.name,
            "email": student.email,
        },
        "items": items,
        "filters": {
            "subjects": subject_options,
            "teachers": dedup_teachers,
            "exams": dedup_exams,
        },
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }


@router.get("/students/{student_id}/subject-behaviour")
def get_student_subject_behaviour(
    student_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    student = db.query(User).filter(User.id == student_id, User.role == RoleEnum.student).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    rows = (
        db.query(Attempt, Assessment)
        .join(Assessment, Attempt.assessment_id == Assessment.id)
        .filter(Attempt.student_id == student.id)
        .all()
    )

    grouped = defaultdict(lambda: defaultdict(int))
    for attempt, assessment in rows:
        label = _derive_behavior_label(attempt, assessment.duration_minutes)
        grouped[assessment.subject or "Unknown"][label] += 1

    items = []
    for subject_name, counts in grouped.items():
        items.append({
            "subject": subject_name,
            "Fast_Response": counts.get("Fast_Response", 0),
            "High_Revision": counts.get("High_Revision", 0),
            "Deliberative": counts.get("Deliberative", 0),
            "Disengaged": counts.get("Disengaged", 0),
        })

    items.sort(key=lambda item: item["subject"])
    return {"items": items}


@router.get("/teachers/{teacher_id}/exams")
def get_teacher_exam_analytics(
    teacher_id: str,
    subject: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    teacher = db.query(User).filter(User.id == teacher_id, User.role == RoleEnum.teacher).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    query = db.query(Assessment).filter(Assessment.created_by == teacher.id)
    if subject and subject.strip():
        query = query.filter(Assessment.subject.ilike(subject.strip()))

    total = query.count()
    exams = (
        query
        .order_by(Assessment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    all_attempts_count = 0
    avg_scores_pool = []
    completion_rates = []

    for exam in exams:
        attempts = db.query(Attempt).filter(Attempt.assessment_id == exam.id).all()
        all_attempts_count += len(attempts)

        scores = [float(item.score) for item in attempts if item.score is not None]
        avg_score = round(sum(scores) / len(scores), 2) if scores else None
        if avg_score is not None:
            avg_scores_pool.append(avg_score)

        duration_values = [_attempt_duration_seconds(item) for item in attempts]
        duration_values = [value for value in duration_values if value is not None]
        avg_time = round(sum(duration_values) / len(duration_values), 2) if duration_values else None

        question_count = db.query(Question).filter(Question.assessment_id == exam.id).count()
        completion_rate = 100.0 if question_count > 0 and len(attempts) > 0 else 0.0
        completion_rates.append(completion_rate)

        behaviour_counts = defaultdict(int)
        for attempt in attempts:
            behaviour_counts[_derive_behavior_label(attempt, exam.duration_minutes)] += 1

        items.append({
            "exam_id": str(exam.id),
            "exam": exam.title,
            "subject": exam.subject,
            "attempts": len(attempts),
            "avg_score": avg_score,
            "avg_time_seconds": avg_time,
            "behaviour_summary": {
                "Fast_Response": behaviour_counts.get("Fast_Response", 0),
                "High_Revision": behaviour_counts.get("High_Revision", 0),
                "Deliberative": behaviour_counts.get("Deliberative", 0),
                "Disengaged": behaviour_counts.get("Disengaged", 0),
            },
        })

    all_teacher_exams = db.query(Assessment).filter(Assessment.created_by == teacher.id).all()
    all_subjects = sorted({exam.subject for exam in all_teacher_exams if exam.subject})

    exams_created_total = len(all_teacher_exams)
    average_exam_score = round(sum(avg_scores_pool) / len(avg_scores_pool), 2) if avg_scores_pool else None
    average_completion_rate = round(sum(completion_rates) / len(completion_rates), 2) if completion_rates else 0.0

    recent_exam_exists = db.query(Assessment).filter(
        Assessment.created_by == teacher.id,
        Assessment.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
    ).first()

    engagement_flags = {
        "inactive_teacher": exams_created_total == 0,
        "low_participation": all_attempts_count < 5 and exams_created_total > 0,
        "high_failure_rate": average_exam_score is not None and average_exam_score < FAIL_THRESHOLD,
        "no_recent_exams": recent_exam_exists is None,
    }

    return {
        "teacher": {
            "id": str(teacher.id),
            "name": teacher.name,
            "email": teacher.email,
            "department": teacher.teacher_profile.department if teacher.teacher_profile else None,
        },
        "metrics": {
            "total_exams_created": exams_created_total,
            "total_student_attempts": all_attempts_count,
            "average_exam_score": average_exam_score,
            "average_completion_rate": average_completion_rate,
        },
        "engagement_flags": engagement_flags,
        "filters": {
            "subjects": all_subjects,
        },
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }
