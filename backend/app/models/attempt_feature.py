from sqlalchemy import Column, Float, ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class AttemptFeature(Base):
    __tablename__ = "attempt_features"

    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), primary_key=True)
    assessment_id = Column(Text, nullable=False)
    subject = Column(String, nullable=False)
    avg_time = Column(Float, nullable=False, default=0.0)
    time_variance = Column(Float, nullable=False, default=0.0)
    revision_count = Column(Integer, nullable=False, default=0)
    wr_ratio = Column(Float, nullable=False, default=0.0)
    rw_ratio = Column(Float, nullable=False, default=0.0)
    navigation_count = Column(Integer, nullable=False, default=0)
    rte_score = Column(Float, nullable=False, default=1.0)
    accuracy = Column(Float, nullable=False, default=0.0)
    behavior_label = Column(String, nullable=False, default="Deliberative")
    label_source = Column(String(32), nullable=False, default="rule")
    unsupervised_cluster = Column(Integer, nullable=True)
    unsupervised_distance = Column(Float, nullable=True)

    attempt = relationship("Attempt", back_populates="attempt_feature")


Index("ix_attempt_features_assessment_id", AttemptFeature.assessment_id)
Index("ix_attempt_features_subject", AttemptFeature.subject)
Index("ix_attempt_features_behavior_label", AttemptFeature.behavior_label)
