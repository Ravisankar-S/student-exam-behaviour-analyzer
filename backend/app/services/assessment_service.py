from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.assessment import Assessment
from app.models.attempt import Attempt
from app.models.user import User
from app.models.activity_log import TeacherActivityLog
from app.schemas.assessment import AssessmentCreate, AssessmentUpdate, TeacherActivityLogCreate
from uuid import UUID
from datetime import datetime, timezone


def _to_utc_iso(value):
    if value is None:
        return None
    normalized = _as_naive_utc(value)
    return normalized.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _serialize(a: Assessment, db: Session) -> dict:
    count = db.query(Attempt).filter(Attempt.assessment_id == a.id).count()
    from app.models.question import Question
    q_count = db.query(Question).filter(Question.assessment_id == a.id).count()
    return {
        "id": str(a.id),
        "title": a.title,
        "subject": a.subject,
        "duration_minutes": a.duration_minutes,
        "published": a.published,
        "available_from": _to_utc_iso(a.available_from),
        "available_until": _to_utc_iso(a.available_until),
        "closed_manually": bool(a.closed_manually),
        "manually_closed_at": _to_utc_iso(a.manually_closed_at),
        "order_index": a.order_index,
        "created_by": str(a.created_by),
        "created_at": a.created_at.isoformat(),
        "attempt_count": count,
        "question_count": q_count,
    }


def _serialize_activity_log(log: TeacherActivityLog) -> dict:
    subject_text = (log.exam_subject or "").strip()
    subject_suffix = f" [{subject_text}]" if subject_text else ""
    return {
        "id": str(log.id),
        "teacher_id": str(log.teacher_id),
        "assessment_id": log.assessment_id,
        "exam_title": log.exam_title,
        "exam_subject": log.exam_subject,
        "action": log.action,
        "message": f"{log.exam_title}{subject_suffix} {log.action}",
        "created_at": _to_utc_iso(log.created_at),
    }


def _normalized(value: str) -> str:
    return (value or "").strip().lower()


def _ensure_no_duplicate_exam(
    db: Session,
    teacher_id: UUID,
    title: str,
    subject: str,
    exclude_assessment_id: str = None,
):
    title_norm = _normalized(title)
    subject_norm = _normalized(subject)
    if not title_norm or not subject_norm:
        return

    query = db.query(Assessment).filter(
        Assessment.created_by == teacher_id,
        func.lower(func.trim(Assessment.title)) == title_norm,
        func.lower(func.trim(Assessment.subject)) == subject_norm,
    )
    if exclude_assessment_id:
        query = query.filter(Assessment.id != exclude_assessment_id)

    existing = query.first()
    if existing:
        raise ValueError("Duplicate exam exists for the same title and subject")


def _as_naive_utc(value):
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def get_teacher_activity_logs(db: Session, teacher_id: UUID, limit: int = 100):
    safe_limit = max(1, min(limit, 500))
    rows = (
        db.query(TeacherActivityLog)
        .filter(TeacherActivityLog.teacher_id == teacher_id)
        .order_by(TeacherActivityLog.created_at.desc())
        .limit(safe_limit)
        .all()
    )
    return [_serialize_activity_log(row) for row in rows]


def create_teacher_activity_log(db: Session, teacher_id: UUID, data: TeacherActivityLogCreate):
    title = (data.exam_title or "").strip()
    action = (data.action or "").strip()
    if not title:
        raise ValueError("Exam title is required")
    if not action:
        raise ValueError("Action is required")

    row = TeacherActivityLog(
        teacher_id=teacher_id,
        assessment_id=(data.assessment_id or "").strip() or None,
        exam_title=title,
        exam_subject=(data.exam_subject or "").strip() or None,
        action=action,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_activity_log(row)


def get_teacher_assessments(db: Session, teacher_id: UUID):
    assessments = (
        db.query(Assessment)
        .filter(Assessment.created_by == teacher_id)
        .order_by(Assessment.order_index.asc(), Assessment.created_at.asc())
        .all()
    )
    return [_serialize(a, db) for a in assessments]


def create_assessment(db: Session, data: AssessmentCreate, teacher_id: UUID):
    from app.models.question import Question
    available_from = _as_naive_utc(data.available_from)
    available_until = _as_naive_utc(data.available_until)
    if available_from and available_until and available_until <= available_from:
        raise ValueError("End time must be later than start time")

    _ensure_no_duplicate_exam(db, teacher_id, data.title, data.subject)

    max_order = db.query(Assessment).filter(Assessment.created_by == teacher_id).count()
    assessment = Assessment(
        title=data.title,
        subject=data.subject,
        duration_minutes=data.duration_minutes,
        published=data.published,
        available_from=available_from,
        available_until=available_until,
        closed_manually=bool(data.closed_manually),
        manually_closed_at=datetime.utcnow() if data.closed_manually else None,
        created_by=teacher_id,
        order_index=max_order,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return _serialize(assessment, db)


def get_assessment_by_id(db: Session, assessment_id: str, teacher_id: UUID):
    return (
        db.query(Assessment)
        .filter(Assessment.id == assessment_id, Assessment.created_by == teacher_id)
        .first()
    )


def update_assessment(db: Session, assessment_id: str, data: AssessmentUpdate, teacher_id: UUID):
    assessment = get_assessment_by_id(db, assessment_id, teacher_id)
    if not assessment:
        return None
    fields_set = getattr(data, "model_fields_set", getattr(data, "__fields_set__", set()))

    next_title = data.title if data.title is not None else assessment.title
    next_subject = data.subject if data.subject is not None else assessment.subject
    _ensure_no_duplicate_exam(db, teacher_id, next_title, next_subject, exclude_assessment_id=assessment_id)

    if data.title is not None:
        assessment.title = data.title
    if data.subject is not None:
        assessment.subject = data.subject
    if data.duration_minutes is not None:
        assessment.duration_minutes = data.duration_minutes
    if data.published is not None:
        assessment.published = data.published
    if "available_from" in fields_set:
        assessment.available_from = _as_naive_utc(data.available_from)
    if "available_until" in fields_set:
        assessment.available_until = _as_naive_utc(data.available_until)

    available_from = _as_naive_utc(assessment.available_from)
    available_until = _as_naive_utc(assessment.available_until)
    if available_from and available_until and available_until <= available_from:
        raise ValueError("End time must be later than start time")

    if "closed_manually" in fields_set and data.closed_manually is not None:
        assessment.closed_manually = bool(data.closed_manually)
        assessment.manually_closed_at = datetime.utcnow() if assessment.closed_manually else None

    db.commit()
    db.refresh(assessment)
    return _serialize(assessment, db)


def delete_assessment(db: Session, assessment_id: str, teacher_id: UUID):
    assessment = get_assessment_by_id(db, assessment_id, teacher_id)
    if not assessment:
        return False
    db.delete(assessment)
    db.commit()
    return True


def reorder_assessments(db: Session, ids: list, teacher_id: UUID):
    for idx, aid in enumerate(ids):
        assessment = db.query(Assessment).filter(
            Assessment.id == aid,
            Assessment.created_by == teacher_id,
        ).first()
        if assessment:
            assessment.order_index = idx
    db.commit()
    return True


def get_assessment_attempts(db: Session, assessment_id: str, teacher_id: UUID):
    assessment = get_assessment_by_id(db, assessment_id, teacher_id)
    if not assessment:
        return None
    attempts = (
        db.query(Attempt)
        .filter(Attempt.assessment_id == assessment_id)
        .order_by(Attempt.started_at.desc())
        .all()
    )
    result = []
    for att in attempts:
        student = db.query(User).filter(User.id == att.student_id).first()
        result.append({
            "id": str(att.id),
            "assessment_id": str(att.assessment_id),
            "student_id": str(att.student_id),
            "student_name": student.name if student else "Unknown",
            "student_email": student.email if student else "",
            "started_at": att.started_at.isoformat() if att.started_at else None,
            "submitted_at": att.submitted_at.isoformat() if att.submitted_at else None,
            "score": att.score,
        })
    return result
