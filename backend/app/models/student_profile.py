from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    reg_no = Column(String, unique=True, index=True, nullable=True)
    college_email = Column(String, unique=True, index=True, nullable=True)
    department = Column(String, nullable=True)
    division = Column(String, nullable=True)
    class_roll_no = Column(String, nullable=True)
    semester = Column(Integer, nullable=True)
    year_of_joining = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="student_profile")
