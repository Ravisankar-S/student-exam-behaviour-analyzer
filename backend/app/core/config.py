from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]  # project root

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    EMAIL_ENABLED: bool = False
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = ""
    EMAIL_DEV_TO: str = ""

    STUDENT_SIGNUP_SUBJECT: str = "Signup request received"
    STUDENT_SIGNUP_BODY: str = (
        "Hello {name},\n\n"
        "We received your signup request for Argus.ai. "
        "Your account will be activated once verified by admin.\n\n"
        "Thank you."
    )

    STUDENT_APPROVED_SUBJECT: str = "Your student account is approved"
    STUDENT_APPROVED_BODY: str = (
        "Hello {name},\n\n"
        "Your account has been approved. You can now sign in.\n"
        "Temporary password: {password}\n\n"
        "Please change your password immediately after login."
    )

    FACULTY_APPROVED_SUBJECT: str = "Your faculty account is ready"
    FACULTY_APPROVED_BODY: str = (
        "Hello {name},\n\n"
        "Your faculty account has been created by admin.\n"
        "Temporary password: {password}\n\n"
        "Please change your password immediately after login."
    )

    class Config:
        env_file = BASE_DIR / ".env"

settings = Settings() # type: ignore