from sqlalchemy.orm import Session
from app.models.question import Question, Option
from app.models.assessment import Assessment
from app.schemas.question import QuestionCreate, QuestionUpdate
from uuid import UUID


def _serialize_question(q: Question) -> dict:
    return {
        "id": str(q.id),
        "assessment_id": str(q.assessment_id),
        "question_text": q.question_text,
        "order_index": q.order_index,
        "options": [
            {
                "id": str(o.id),
                "question_id": str(o.question_id),
                "option_text": o.option_text,
                "is_correct": o.is_correct,
                "order_index": o.order_index,
            }
            for o in q.options
        ],
    }


def get_questions(db: Session, assessment_id: str, teacher_id: UUID):
    a = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.created_by == teacher_id,
    ).first()
    if not a:
        return None
    questions = (
        db.query(Question)
        .filter(Question.assessment_id == assessment_id)
        .order_by(Question.order_index)
        .all()
    )
    return [_serialize_question(q) for q in questions]


def create_question(db: Session, assessment_id: str, data: QuestionCreate, teacher_id: UUID):
    a = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.created_by == teacher_id,
    ).first()
    if not a:
        return None

    max_order = db.query(Question).filter(Question.assessment_id == assessment_id).count()
    question = Question(
        assessment_id=assessment_id,
        question_text=data.question_text,
        order_index=max_order,
    )
    db.add(question)
    db.flush()

    for idx, opt in enumerate(data.options):
        option = Option(
            question_id=question.id,
            option_text=opt.option_text,
            is_correct=opt.is_correct,
            order_index=idx,
        )
        db.add(option)

    db.commit()
    db.refresh(question)
    return _serialize_question(question)


def update_question(
    db: Session,
    assessment_id: str,
    question_id: str,
    data: QuestionUpdate,
    teacher_id: UUID,
):
    a = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.created_by == teacher_id,
    ).first()
    if not a:
        return None

    question = db.query(Question).filter(
        Question.id == question_id,
        Question.assessment_id == assessment_id,
    ).first()
    if not question:
        return None

    if data.question_text is not None:
        question.question_text = data.question_text

    if data.options is not None:
        for old_opt in question.options:
            db.delete(old_opt)
        db.flush()
        for idx, opt in enumerate(data.options):
            option = Option(
                question_id=question.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                order_index=idx,
            )
            db.add(option)

    db.commit()
    db.refresh(question)
    return _serialize_question(question)


def delete_question(db: Session, assessment_id: str, question_id: str, teacher_id: UUID):
    a = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.created_by == teacher_id,
    ).first()
    if not a:
        return False

    question = db.query(Question).filter(
        Question.id == question_id,
        Question.assessment_id == assessment_id,
    ).first()
    if not question:
        return False

    db.delete(question)
    db.commit()

    # Re-number order indices
    remaining = (
        db.query(Question)
        .filter(Question.assessment_id == assessment_id)
        .order_by(Question.order_index)
        .all()
    )
    for i, q in enumerate(remaining):
        q.order_index = i
    db.commit()
    return True


def reorder_questions(db: Session, assessment_id: str, ids: list, teacher_id: UUID):
    a = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.created_by == teacher_id,
    ).first()
    if not a:
        return False

    for idx, qid in enumerate(ids):
        question = db.query(Question).filter(
            Question.id == qid,
            Question.assessment_id == assessment_id,
        ).first()
        if question:
            question.order_index = idx
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
