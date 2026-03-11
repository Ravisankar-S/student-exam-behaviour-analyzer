from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.assessment import AssessmentCreate, AssessmentUpdate
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

router = APIRouter(prefix="/assessments", tags=["assessments"])


def require_teacher(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.teacher:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return current_user


@router.get("/mine")
def list_my_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    return get_teacher_assessments(db, current_user.id)


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
