from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.schemas.question import QuestionCreate, QuestionUpdate, ReorderRequest
from app.services.question_service import (
    get_questions,
    create_question,
    update_question,
    delete_question,
    reorder_questions,
)
from app.api.deps import get_db, get_current_user
from app.models.user import User, RoleEnum
from app.models.assessment import Assessment
from app.utils.uploads import save_image_upload

router = APIRouter(prefix="/assessments", tags=["questions"])


def require_teacher(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.teacher:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return current_user


@router.get("/{assessment_id}/questions")
def list_questions(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = get_questions(db, assessment_id, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return result


@router.post("/{assessment_id}/questions", status_code=201)
def create(
    assessment_id: str,
    data: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = create_question(db, assessment_id, data, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return result


@router.post("/{assessment_id}/questions/upload-image")
def upload_question_image(
    assessment_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.created_by == current_user.id,
    ).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    path = save_image_upload(file, "questions")
    return {"question_image_path": path}


# NOTE: /reorder must be defined BEFORE /{question_id} to avoid route conflict
@router.patch("/{assessment_id}/questions/reorder")
def reorder(
    assessment_id: str,
    data: ReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    ok = reorder_questions(db, assessment_id, data.ids, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"ok": True}


@router.patch("/{assessment_id}/questions/{question_id}")
def update(
    assessment_id: str,
    question_id: str,
    data: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    result = update_question(db, assessment_id, question_id, data, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return result


@router.delete("/{assessment_id}/questions/{question_id}", status_code=204)
def delete(
    assessment_id: str,
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    ok = delete_question(db, assessment_id, question_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Question not found")
