from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.db.base import Base
from datetime import datetime


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    published = Column(Boolean, default=False)
    closed_manually = Column(Boolean, default=False)
    order_index = Column(Integer, nullable=False, default=0)
    available_from = Column(DateTime, nullable=True)
    available_until = Column(DateTime, nullable=True)
    manually_closed_at = Column(DateTime, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", back_populates="assessments")
    attempts = relationship("Attempt", back_populates="assessment", cascade="all, delete-orphan")
    questions = relationship(
        "Question",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
    )
