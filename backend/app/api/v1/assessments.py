from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.assessment import AssessmentCreate, AssessmentUpdate, StudentAttemptSubmitRequest
from app.schemas.question import ReorderRequest
from app.services.assessment_service import (
    get_teacher_assessments,
    create_assessment,
    get_assessment_by_id,
    update_assessment,
    delete_assessment,
    reorder_assessments,
    get_assessment_attempts,
    _serialize,
)
from app.api.deps import get_db, get_current_user
from app.models.user import User, RoleEnum
from app.models.attempt import Attempt
from app.models.assessment import Assessment
from app.models.question import Question
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/assessments", tags=["assessments"])


def require_teacher(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.teacher:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return current_user


def require_student(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Student access required")
    return current_user


def _serialize_published_assessment(a: Assessment, db: Session):
    q_count = db.query(Question).filter(Question.assessment_id == a.id).count()
    return {
        "id": str(a.id),
        "title": a.title,
        "subject": a.subject,
        "duration_minutes": a.duration_minutes,
        "question_count": q_count,
        "created_by": str(a.created_by),
        "teacher_id": str(a.created_by),
        "teacher_name": a.creator.name if a.creator else None,
        "teacher_department": a.creator.teacher_profile.department if a.creator and a.creator.teacher_profile else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("/mine")
def list_my_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    return get_teacher_assessments(db, current_user.id)


@router.get("/published")
def list_published_assessments(
    q: Optional[str] = None,
    subject: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_student),
):
    query = db.query(Assessment).filter(Assessment.published.is_(True))

    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter((Assessment.title.ilike(keyword)) | (Assessment.subject.ilike(keyword)))

    if subject and subject.strip():
        query = query.filter(Assessment.subject.ilike(subject.strip()))

    exams = query.order_by(Assessment.created_at.desc()).all()
    return [_serialize_published_assessment(exam, db) for exam in exams]


@router.get("/{assessment_id}/public-questions")
def get_public_questions(
    assessment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_student),
):
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.published.is_(True),
    ).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Published assessment not found")

    questions = db.query(Question).filter(
        Question.assessment_id == assessment.id,
    ).order_by(Question.order_index.asc(), Question.created_at.asc()).all()

    return [
        {
            "id": str(question.id),
            "question_text": question.question_text,
            "question_image_path": question.question_image_path,
            "order_index": question.order_index,
            "options": [
                {
                    "id": str(option.id),
                    "option_text": option.option_text,
                    "order_index": option.order_index,
                }
                for option in question.options
            ],
        }
        for question in questions
    ]


@router.post("/{assessment_id}/submit-attempt")
def submit_student_attempt(
    assessment_id: str,
    data: StudentAttemptSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_student),
):
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.published.is_(True),
    ).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Published assessment not found")

    questions = db.query(Question).filter(
        Question.assessment_id == assessment.id,
    ).order_by(Question.order_index.asc(), Question.created_at.asc()).all()
    if not questions:
        raise HTTPException(status_code=400, detail="No questions found for this assessment")

    expected_ids = {str(question.id) for question in questions}
    if len(data.responses) != len(expected_ids):
        raise HTTPException(status_code=400, detail="All questions must be answered or skipped")

    seen_ids = set()
    attempted_count = 0
    skipped_count = 0
    correct_count = 0

    question_map = {str(question.id): question for question in questions}
    for response in data.responses:
        question_id = response.question_id
        if question_id in seen_ids:
            raise HTTPException(status_code=400, detail="Duplicate question response detected")
        if question_id not in expected_ids:
            raise HTTPException(status_code=400, detail="Invalid question in submission")

        seen_ids.add(question_id)
        if response.skipped:
            skipped_count += 1
            continue

        if not response.selected_option_id:
            raise HTTPException(status_code=400, detail="Selected option is required for answered questions")

        attempted_count += 1
        question = question_map[question_id]
        selected_option = next((option for option in question.options if str(option.id) == response.selected_option_id), None)
        if not selected_option:
            raise HTTPException(status_code=400, detail="Invalid selected option")
        if selected_option.is_correct:
            correct_count += 1

    score = round((correct_count / len(questions)) * 100, 2)
    started_at = data.started_at or datetime.utcnow()
    submitted_at = data.submitted_at or datetime.utcnow()

    attempt = Attempt(
        assessment_id=assessment.id,
        student_id=current_user.id,
        started_at=started_at,
        submitted_at=submitted_at,
        score=score,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {
        "attempt_id": str(attempt.id),
        "assessment_id": str(assessment.id),
        "total_questions": len(questions),
        "attempted": attempted_count,
        "skipped": skipped_count,
        "correct": correct_count,
        "score": score,
        "message": "Attempt submitted successfully",
    }


# NOTE: /reorder must be before /{assessment_id}
@router.patch("/reorder")
def reorder(
    data: ReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    reorder_assessments(db, data.ids, current_user.id)
    return {"ok": True}


@router.post("/", status_code=201)
def create(
    data: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    return create_assessment(db, data, current_user.id)


@router.get("/{assessment_id}")
def get_one(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    a = get_assessment_by_id(db, assessment_id, current_user.id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return _serialize(a, db)


@router.patch("/{assessment_id}")
def update(
    assessment_id: str,
    data: AssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = update_assessment(db, assessment_id, data, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return result


@router.delete("/{assessment_id}", status_code=204)
def delete(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    success = delete_assessment(db, assessment_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Assessment not found")


@router.get("/{assessment_id}/attempts")
def list_attempts(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    attempts = get_assessment_attempts(db, assessment_id, current_user.id)
    if attempts is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return attempts
