from app.core.security import hash_password
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.models.assessment import Assessment
from app.models.question import Option, Question
from app.models.teacher_profile import TeacherProfile
from app.models.user import AuthProviderEnum, RoleEnum, User
from app.services.display_code_service import generate_next_display_code
from typing import Any


TEACHER_NAME = "Seed Faculty"
TEACHER_EMAIL = "faculty.seed@cusat.ac.in"
TEACHER_PASSWORD = "facSeed@123"

ASSESSMENT_TITLE = "Behavioral Analytics Seed Test (10Q)"
ASSESSMENT_SUBJECT = "General Aptitude"
ASSESSMENT_DURATION_MINUTES = 30

QUESTION_BANK = [
    {
        "question": "Which data structure is used in Breadth-First Search (BFS)?",
        "options": ["Stack", "Queue", "Heap", "Hash Table"],
        "correct_index": 1,
    },
    {
        "question": "What is 15% of 240?",
        "options": ["24", "30", "36", "42"],
        "correct_index": 2,
    },
    {
        "question": "If all A are B and all B are C, which statement is definitely true?",
        "options": ["All C are A", "All A are C", "Some C are not B", "No A are C"],
        "correct_index": 1,
    },
    {
        "question": "What is the time complexity of binary search on a sorted array?",
        "options": ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
        "correct_index": 1,
    },
    {
        "question": "The expression |2x - 5| = 9 has which solution set?",
        "options": ["x = 7 only", "x = -2 only", "x = 7 or x = -2", "x = 2 or x = -7"],
        "correct_index": 2,
    },
    {
        "question": "Which SQL clause is used to aggregate rows by a column?",
        "options": ["ORDER BY", "WHERE", "GROUP BY", "HAVING"],
        "correct_index": 2,
    },
    {
        "question": "The derivative of sin x * cos x is:",
        "options": ["sin(2x)", "cos(2x)", "-sin(2x)", "tan(2x)"],
        "correct_index": 1,
    },
    {
        "question": "If two fair coins are tossed, probability of getting exactly one head is:",
        "options": ["1/4", "1/2", "3/4", "1"],
        "correct_index": 1,
    },
    {
        "question": "In cybersecurity, phishing is best described as:",
        "options": [
            "Encrypting data in transit",
            "Scanning ports for vulnerabilities",
            "Tricking users into revealing sensitive information",
            "Blocking traffic using a firewall",
        ],
        "correct_index": 2,
    },
    {
        "question": "Find the next term: 2, 6, 12, 20, 30, ?",
        "options": ["36", "40", "42", "44"],
        "correct_index": 2,
    },
]


def ensure_teacher(db):
    teacher = db.query(User).filter(User.email == TEACHER_EMAIL).first()
    if teacher is None:
        teacher = User(
            name=TEACHER_NAME,
            email=TEACHER_EMAIL,
            password_hash=hash_password(TEACHER_PASSWORD),
            role=RoleEnum.teacher,
            auth_provider=AuthProviderEnum.local,
            provider_id=None,
        )
        db.add(teacher)
        db.flush()

    teacher_updates: dict[str, Any] = {
        "role": RoleEnum.teacher,
        "name": TEACHER_NAME,
        "auth_provider": AuthProviderEnum.local,
        "provider_id": None,
    }
    for field_name, field_value in teacher_updates.items():
        setattr(teacher, field_name, field_value)

    profile = db.query(TeacherProfile).filter(TeacherProfile.user_id == teacher.id).first()
    if profile is None:
        profile = TeacherProfile(user_id=teacher.id)
        db.add(profile)

    if not str(getattr(profile, "college_email", "") or "").strip():
        setattr(profile, "college_email", TEACHER_EMAIL)
    if not str(getattr(profile, "department", "") or "").strip():
        setattr(profile, "department", "Computer Science")
    if not str(getattr(profile, "designation", "") or "").strip():
        setattr(profile, "designation", "Assistant Professor")

    return teacher


def ensure_assessment(db, teacher_id):
    assessment = (
        db.query(Assessment)
        .filter(
            Assessment.created_by == teacher_id,
            Assessment.title == ASSESSMENT_TITLE,
            Assessment.subject == ASSESSMENT_SUBJECT,
        )
        .first()
    )

    if assessment is None:
        assessment = Assessment(
            assessment_code=generate_next_display_code(db, Assessment, "assessment_code", "EX", 6),
            title=ASSESSMENT_TITLE,
            subject=ASSESSMENT_SUBJECT,
            duration_minutes=ASSESSMENT_DURATION_MINUTES,
            published=True,
            closed_manually=False,
            created_by=teacher_id,
            order_index=0,
        )
        db.add(assessment)
        db.flush()

    assessment_updates: dict[str, Any] = {
        "duration_minutes": ASSESSMENT_DURATION_MINUTES,
        "published": True,
        "closed_manually": False,
    }
    for field_name, field_value in assessment_updates.items():
        setattr(assessment, field_name, field_value)
    return assessment


def seed_questions(db, assessment):
    existing = db.query(Question).filter(Question.assessment_id == assessment.id).all()
    for row in existing:
        db.delete(row)
    db.flush()

    for q_index, item in enumerate(QUESTION_BANK):
        question = Question(
            assessment_id=assessment.id,
            question_text=item["question"],
            order_index=q_index,
        )
        db.add(question)
        db.flush()

        for o_index, option_text in enumerate(item["options"]):
            option = Option(
                question_id=question.id,
                option_text=option_text,
                order_index=o_index,
                is_correct=(o_index == item["correct_index"]),
            )
            db.add(option)



def seed_assessment_questions():
    init_db()
    db = SessionLocal()
    try:
        teacher = ensure_teacher(db)
        assessment = ensure_assessment(db, teacher.id)
        seed_questions(db, assessment)
        db.commit()

        print("Seed completed.")
        print(f"Teacher: {TEACHER_EMAIL}")
        print(f"Assessment: {assessment.assessment_code} - {assessment.title}")
        print(f"Questions seeded: {len(QUESTION_BANK)}")
    except Exception as exc:
        db.rollback()
        raise RuntimeError(f"Failed to seed assessment questions: {exc}") from exc
    finally:
        db.close()


if __name__ == "__main__":
    seed_assessment_questions()
