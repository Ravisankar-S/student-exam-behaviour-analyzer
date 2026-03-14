from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    employee_id = Column(String, unique=True, index=True, nullable=True)
    college_email = Column(String, unique=True, index=True, nullable=True)
    department = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    subjects = Column(String, nullable=True)
    office_room = Column(String, nullable=True)
    year_of_joining = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="teacher_profile")
