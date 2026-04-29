from sqlalchemy import Column, Float, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.db.base import Base
from datetime import datetime


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_code = Column(String(16), unique=True, index=True, nullable=True)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    score = Column(Float, nullable=True)

    assessment = relationship("Assessment", back_populates="attempts")
    student = relationship("User", foreign_keys=[student_id])
    event_logs = relationship("EventLog", back_populates="attempt", cascade="all, delete-orphan")
    attempt_feature = relationship("AttemptFeature", back_populates="attempt", uselist=False, cascade="all, delete-orphan")
