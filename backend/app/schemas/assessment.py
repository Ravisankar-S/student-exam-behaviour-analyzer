from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from uuid import UUID


class AssessmentCreate(BaseModel):
    title: str
    subject: str
    duration_minutes: int = 60
    published: bool = False


class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    duration_minutes: Optional[int] = None
    published: Optional[bool] = None


class AssessmentOut(BaseModel):
    id: UUID
    title: str
    subject: str
    duration_minutes: int
    published: bool
    created_by: UUID
    created_at: datetime
    attempt_count: int = 0

    class Config:
        from_attributes = True


class StudentAttemptResponseItem(BaseModel):
    question_id: str
    selected_option_id: Optional[str] = None
    skipped: bool = False


class StudentAttemptSubmitRequest(BaseModel):
    responses: List[StudentAttemptResponseItem]
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
