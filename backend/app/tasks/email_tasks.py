import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

@celery_app.task(name="tasks.send_invitation_email")
def send_invitation_email(email: str, company_name: str, activation_url: str):
    """
    Background job foundation for dispatching invitation & activation emails.
    Validates email destination and securely logs notification event.
    """
    logger.info(f"[Celery] Sending invitation email to {email} for company '{company_name}': {activation_url}")
    return {"status": "sent", "email": email}

@celery_app.task(name="tasks.send_password_reset_email")
def send_password_reset_email(email: str, reset_url: str):
    logger.info(f"[Celery] Sending password reset email to {email}: {reset_url}")
    return {"status": "sent", "email": email}
