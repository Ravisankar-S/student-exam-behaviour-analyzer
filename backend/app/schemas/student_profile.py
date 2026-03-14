from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class StudentProfileOut(BaseModel):
    user_id: UUID
    reg_no: Optional[str] = None
    college_email: Optional[str] = None
    department: Optional[str] = None
    division: Optional[str] = None
    class_roll_no: Optional[str] = None
    semester: Optional[int] = None
    year_of_joining: Optional[int] = None

    class Config:
        from_attributes = True


class StudentProfileUpdateRequest(BaseModel):
    reg_no: Optional[str] = None
    college_email: Optional[str] = None
    department: Optional[str] = None
    division: Optional[str] = None
    class_roll_no: Optional[str] = None
    semester: Optional[int] = None
    year_of_joining: Optional[int] = None