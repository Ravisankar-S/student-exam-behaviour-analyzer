import logging
from html import escape
import resend
from app.core.config import settings

logger = logging.getLogger(__name__)


def render_template(template: str, **kwargs) -> str:
    result = template
    for key, value in kwargs.items():
        result = result.replace(f"{{{key}}}", str(value if value is not None else ""))
    return result


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not settings.EMAIL_ENABLED:
        logger.info("Email sending skipped because EMAIL_ENABLED is false")
        return False

    if not settings.RESEND_API_KEY:
        logger.warning("Email sending skipped because RESEND_API_KEY is not configured")
        return False

    if not settings.EMAIL_FROM:
        logger.warning("Email sending skipped because EMAIL_FROM is not configured")
        return False

    recipient = settings.EMAIL_DEV_TO.strip() if settings.EMAIL_DEV_TO else to_email
    if settings.EMAIL_DEV_TO:
        logger.info("Email dev override active: routing %s to %s", to_email, recipient)

    html_body = escape(body).replace("\n", "<br>")

    try:
        resend.api_key = settings.RESEND_API_KEY
        response = resend.Emails.send(
            {
                "from": settings.EMAIL_FROM,
                "to": [recipient],
                "subject": subject,
                "text": body,
                "html": html_body,
            }
        )
        logger.info("Email sent via Resend to %s: %s", recipient, response)
        return True
    except Exception as exc:
        logger.exception("Failed to send email to %s with subject %s: %s", to_email, subject, exc)
        return False
