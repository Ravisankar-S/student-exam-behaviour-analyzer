from app.db.session import engine
from app.db.base import Base
from sqlalchemy import text
from app.models.user import User          # noqa: F401
from app.models.student_profile import StudentProfile  # noqa: F401
from app.models.teacher_profile import TeacherProfile  # noqa: F401
from app.models.admission_request import AdmissionRequest  # noqa: F401
from app.models.faculty_request import FacultyRequest  # noqa: F401
from app.models.assessment import Assessment  # noqa: F401
from app.models.attempt import Attempt    # noqa: F401
from app.models.question import Question, Option  # noqa: F401


def _sync_profile_columns():
    statements = [
        "ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS year_of_joining INTEGER",
        "ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS year_of_joining INTEGER",
        "ALTER TABLE faculty_requests ADD COLUMN IF NOT EXISTS year_of_joining INTEGER",
    ]

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))


def init_db():
    Base.metadata.create_all(bind=engine)
    _sync_profile_columns()
