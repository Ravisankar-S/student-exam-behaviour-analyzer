from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class TeacherProfileOut(BaseModel):
    user_id: UUID
    employee_id: Optional[str] = None
    college_email: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    subjects: Optional[str] = None
    office_room: Optional[str] = None
    year_of_joining: Optional[int] = None

    class Config:
        from_attributes = True


class TeacherProfileUpdateRequest(BaseModel):
    employee_id: Optional[str] = None
    college_email: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    subjects: Optional[str] = None
    office_room: Optional[str] = None
    year_of_joining: Optional[int] = None
