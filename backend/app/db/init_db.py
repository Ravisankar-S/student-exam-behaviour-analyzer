from app.db.session import engine
from app.db.base import Base
from app.models.user import User          # noqa: F401
from app.models.assessment import Assessment  # noqa: F401
from app.models.attempt import Attempt    # noqa: F401
from app.models.question import Question, Option  # noqa: F401


def init_db():
    Base.metadata.create_all(bind=engine)
