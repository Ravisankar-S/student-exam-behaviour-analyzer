from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class EventLog(Base):
    __tablename__ = "event_logs"

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_code = Column(String(16), unique=True, index=True, nullable=True)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    question_id = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    time_spent_sec = Column(Float, nullable=False, default=0.0)
    selected_option = Column(String(1), nullable=True)
    answer_changed = Column(Boolean, nullable=False, default=False)
    visit_index = Column(Integer, nullable=False, default=1)

    attempt = relationship("Attempt", back_populates="event_logs")


Index("ix_event_logs_attempt_id", EventLog.attempt_id)
Index("ix_event_logs_student_id", EventLog.student_id)
Index("ix_event_logs_question_id", EventLog.question_id)
Index("ix_event_logs_timestamp", EventLog.timestamp)
