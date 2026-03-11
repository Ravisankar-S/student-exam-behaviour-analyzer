from sqlalchemy.orm import Session
from app.models.assessment import Assessment
from app.models.attempt import Attempt
from app.models.user import User
from app.schemas.assessment import AssessmentCreate, AssessmentUpdate
from uuid import UUID


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
        "order_index": a.order_index,
        "created_by": str(a.created_by),
        "created_at": a.created_at.isoformat(),
        "attempt_count": count,
        "question_count": q_count,
    }


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
    max_order = db.query(Assessment).filter(Assessment.created_by == teacher_id).count()
    assessment = Assessment(
        title=data.title,
        subject=data.subject,
        duration_minutes=data.duration_minutes,
        published=data.published,
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
    if data.title is not None:
        assessment.title = data.title
    if data.subject is not None:
        assessment.subject = data.subject
    if data.duration_minutes is not None:
        assessment.duration_minutes = data.duration_minutes
    if data.published is not None:
        assessment.published = data.published
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
