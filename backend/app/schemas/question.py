from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID


class OptionCreate(BaseModel):
    option_text: str
    is_correct: bool = False


class OptionOut(BaseModel):
    id: UUID
    question_id: UUID
    option_text: str
    is_correct: bool
    order_index: int

    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    question_text: str
    question_image_path: Optional[str] = None
    options: List[OptionCreate]


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_image_path: Optional[str] = None
    options: Optional[List[OptionCreate]] = None


class QuestionOut(BaseModel):
    id: UUID
    assessment_id: UUID
    question_text: str
    question_image_path: Optional[str]
    order_index: int
    options: List[OptionOut]

    class Config:
        from_attributes = True


class ReorderRequest(BaseModel):
    ids: List[str]
