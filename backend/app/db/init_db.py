from app.db.session import engine
from app.db.base import Base
from sqlalchemy import text
from app.models.user import User          # noqa: F401
from app.models.student_profile import StudentProfile  # noqa: F401
from app.models.teacher_profile import TeacherProfile  # noqa: F401
from app.models.admission_request import AdmissionRequest  # noqa: F401
from app.models.assessment import Assessment  # noqa: F401
from app.models.attempt import Attempt    # noqa: F401
from app.models.question import Question, Option  # noqa: F401
from app.models.activity_log import TeacherActivityLog  # noqa: F401
from app.models.event_log import EventLog  # noqa: F401
from app.models.attempt_feature import AttemptFeature  # noqa: F401


def _sync_profile_columns():
    statements = [
        "ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS year_of_joining INTEGER",
        "ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS year_of_joining INTEGER",
        "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS assessment_code VARCHAR(16)",
        "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS attempt_code VARCHAR(16)",
        "ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS event_code VARCHAR(16)",
        "ALTER TABLE admission_requests ADD COLUMN IF NOT EXISTS request_code VARCHAR(16)",
        "ALTER TABLE attempt_features ADD COLUMN IF NOT EXISTS label_source VARCHAR(32)",
        "ALTER TABLE attempt_features ADD COLUMN IF NOT EXISTS unsupervised_cluster INTEGER",
        "ALTER TABLE attempt_features ADD COLUMN IF NOT EXISTS unsupervised_distance DOUBLE PRECISION",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_assessments_assessment_code ON assessments (assessment_code)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_attempts_attempt_code ON attempts (attempt_code)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_event_logs_event_code ON event_logs (event_code)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_admission_requests_request_code ON admission_requests (request_code)",
    ]

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))


def init_db():
    Base.metadata.create_all(bind=engine)
    _sync_profile_columns()
