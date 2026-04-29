from pydantic import BaseModel
from pydantic import Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID


class AssessmentCreate(BaseModel):
    title: str
    subject: str
    duration_minutes: int = 60
    published: bool = False
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    closed_manually: bool = False


class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    duration_minutes: Optional[int] = None
    published: Optional[bool] = None
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    closed_manually: Optional[bool] = None


class AssessmentOut(BaseModel):
    id: UUID
    title: str
    subject: str
    duration_minutes: int
    published: bool
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    closed_manually: bool = False
    manually_closed_at: Optional[datetime] = None
    created_by: UUID
    created_at: datetime
    attempt_count: int = 0

    class Config:
        from_attributes = True


class StudentAttemptResponseItem(BaseModel):
    question_id: str
    selected_option_id: Optional[str] = None
    skipped: bool = False


class StudentAttemptEventItem(BaseModel):
    question_id: str
    timestamp: datetime
    time_spent_sec: float = Field(ge=0)
    selected_option: Optional[str] = Field(default=None, pattern="^[A-D]$")
    answer_changed: bool = False
    visit_index: int = Field(ge=1)


class StudentAttemptSubmitRequest(BaseModel):
    responses: List[StudentAttemptResponseItem]
    events: List[StudentAttemptEventItem] = Field(default_factory=list)
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None


class TeacherActivityLogCreate(BaseModel):
    assessment_id: Optional[str] = None
    exam_title: str
    exam_subject: Optional[str] = None
    action: str


class TeacherActivityLogOut(BaseModel):
    id: str
    teacher_id: str
    assessment_id: Optional[str] = None
    exam_title: str
    exam_subject: Optional[str] = None
    action: str
    message: str
    created_at: str
