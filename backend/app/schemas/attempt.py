from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID


class AttemptOut(BaseModel):
    id: UUID
    assessment_id: UUID
    student_id: UUID
    started_at: datetime
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    student_name: str = ""
    student_email: str = ""

    class Config:
        from_attributes = True
