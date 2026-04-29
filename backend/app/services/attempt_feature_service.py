from collections import defaultdict
from typing import Iterable
from typing import Any
from datetime import datetime
import math

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assessment import Assessment
from app.models.attempt import Attempt
from app.models.attempt_feature import AttemptFeature
from app.models.event_log import EventLog
from app.models.question import Question
from app.ml.unsupervised.kmeans.kmeans_behavior import predict_single_feature_row


def _correct_option_letter_map(questions: Iterable[Question]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for question in questions:
        correct_option = next((option for option in question.options if option.is_correct), None)
        if not correct_option:
            continue
        idx = int(correct_option.order_index or 0)
        if 0 <= idx <= 3:
            mapping[str(question.id)] = chr(65 + idx)
    return mapping


def _derive_behavior_label(
    avg_time: float,
    time_variance: float,
    revision_count: int,
    navigation_count: int,
    accuracy: float,
    short_time_ratio: float,
    very_short_time_ratio: float,
    revisit_question_ratio: float,
    late_review_time_ratio: float,
    late_revision_count: int,
    total_questions: int,
) -> str:
    variability_index = (math.sqrt(time_variance) / avg_time) if avg_time > 0 else 0.0

    # Low effort + low performance + minimal interaction.
    if (
        avg_time <= 8
        and very_short_time_ratio >= 0.5
        and accuracy < 0.35
        and revision_count == 0
        and navigation_count <= max(1, total_questions // 5)
    ):
        return "Disengaged"

    # Frequent answer changes dominate this behavior.
    if revision_count >= max(4, int(total_questions * 0.35)):
        return "High-Revision"

    # Completed once and spent notable effort revisiting late in the attempt.
    if (
        navigation_count >= max(3, total_questions // 2)
        and (
            late_review_time_ratio >= 0.25
            or late_revision_count >= 2
            or revisit_question_ratio >= 0.4
        )
    ):
        return "Reviewer"

    # Strongly variable per-question timing pattern.
    if time_variance >= 110 and variability_index >= 0.75:
        return "Inconsistent"

    # Fast but still human-like reading latency, with low interaction overhead.
    if (
        6 <= avg_time <= 18
        and short_time_ratio >= 0.6
        and revision_count <= 1
        and navigation_count <= max(2, total_questions // 3)
    ):
        return "Fast-Response"

    if 20 <= avg_time <= 40 and 1 <= revision_count <= 3:
        return "Deliberative"

    if avg_time > 18 or revision_count > 0 or navigation_count > 0:
        return "Deliberative"

    return "Deliberative"


def compute_and_store_attempt_features(
    db: Session,
    attempt: Attempt,
    assessment: Assessment,
    questions: list[Question],
    event_logs: list[EventLog],
    correct_count: int,
) -> AttemptFeature:
    total_questions = len(questions)
    if total_questions == 0:
        raise ValueError("Cannot compute features without questions")

    question_ids = [str(question.id) for question in questions]
    time_by_question: dict[str, float] = defaultdict(float)

    for event in event_logs:
        qid = str(getattr(event, "question_id"))
        if qid in question_ids:
            spent = float(getattr(event, "time_spent_sec", 0.0) or 0.0)
            time_by_question[qid] += max(0.0, spent)

    per_question_times = [time_by_question.get(qid, 0.0) for qid in question_ids]
    avg_time = sum(per_question_times) / total_questions
    time_variance = sum((value - avg_time) ** 2 for value in per_question_times) / total_questions

    revision_count = sum(1 for event in event_logs if bool(event.answer_changed))
    navigation_count = max(0, len(event_logs) - total_questions)
    accuracy = float(correct_count) / total_questions
    short_time_ratio = sum(1 for value in per_question_times if value <= 12) / total_questions
    very_short_time_ratio = sum(1 for value in per_question_times if value <= 5) / total_questions

    correctness_map = _correct_option_letter_map(questions)
    by_question: dict[str, list[EventLog]] = defaultdict(list)
    for event in event_logs:
        by_question[str(getattr(event, "question_id"))].append(event)

    revisit_question_count = 0
    first_seen_by_question: dict[str, datetime] = {}
    total_event_time = 0.0
    late_review_time = 0.0
    late_revision_count = 0

    wr_count = 0
    rw_count = 0
    for qid, events in by_question.items():
        events.sort(key=lambda item: ((getattr(item, "timestamp") or datetime.min), getattr(item, "visit_index", 0)))
        if any(int(getattr(item, "visit_index", 0) or 0) > 1 for item in events):
            revisit_question_count += 1
        first_timestamp = getattr(events[0], "timestamp", None)
        if first_timestamp is not None:
            first_seen_by_question[qid] = first_timestamp
        prev_correct = None
        correct_letter = correctness_map.get(qid)
        for event in events:
            selected = str(getattr(event, "selected_option", "") or "").upper()
            spent = max(0.0, float(getattr(event, "time_spent_sec", 0.0) or 0.0))
            total_event_time += spent
            if not selected or not correct_letter:
                continue
            is_correct = selected == correct_letter
            if prev_correct is None:
                prev_correct = is_correct
                continue
            if (not prev_correct) and is_correct:
                wr_count += 1
            elif prev_correct and (not is_correct):
                rw_count += 1
            prev_correct = is_correct

    revisit_question_ratio = revisit_question_count / total_questions
    first_pass_end_time = None
    if len(first_seen_by_question) == total_questions:
        first_pass_end_time = max(first_seen_by_question.values())

    if first_pass_end_time is not None and total_event_time > 0:
        for event in event_logs:
            event_time = getattr(event, "timestamp", None)
            if event_time is None or event_time < first_pass_end_time:
                continue
            if int(getattr(event, "visit_index", 0) or 0) <= 1:
                continue
            spent = max(0.0, float(getattr(event, "time_spent_sec", 0.0) or 0.0))
            late_review_time += spent
            if bool(getattr(event, "answer_changed", False)):
                late_revision_count += 1
        late_review_time_ratio = late_review_time / total_event_time
    else:
        late_review_time_ratio = 0.0

    total_direction_changes = wr_count + rw_count
    if total_direction_changes > 0:
        wr_ratio = wr_count / total_direction_changes
        rw_ratio = rw_count / total_direction_changes
    else:
        wr_ratio = 0.0
        rw_ratio = 0.0

    cohort_avg_time = (
        db.query(func.avg(AttemptFeature.avg_time))
        .filter(AttemptFeature.assessment_id == str(assessment.id))
        .scalar()
    )
    if cohort_avg_time and float(cohort_avg_time) > 0:
        rte_score = avg_time / float(cohort_avg_time)
    else:
        rte_score = 1.0

    behavior_label = _derive_behavior_label(
        avg_time=avg_time,
        time_variance=time_variance,
        revision_count=revision_count,
        navigation_count=navigation_count,
        accuracy=accuracy,
        short_time_ratio=short_time_ratio,
        very_short_time_ratio=very_short_time_ratio,
        revisit_question_ratio=revisit_question_ratio,
        late_review_time_ratio=late_review_time_ratio,
        late_revision_count=late_revision_count,
        total_questions=total_questions,
    )
    label_source = "rule"
    unsupervised_cluster = None
    unsupervised_distance = None

    try:
        ml_prediction = predict_single_feature_row(
            {
                "avg_time": round(avg_time, 4),
                "time_variance": round(time_variance, 4),
                "revision_count": float(revision_count),
                "navigation_count": float(navigation_count),
                "accuracy": round(accuracy, 4),
                "rte_score": round(rte_score, 4),
            }
        )
        behavior_label = str(ml_prediction["interpreted_behavior"])
        label_source = "unsupervised"
        unsupervised_cluster = int(ml_prediction["predicted_cluster"])
        unsupervised_distance = float(ml_prediction["min_distance"])
    except Exception:
        # Fallback to deterministic rule labels when model artifacts are unavailable.
        pass

    feature = db.query(AttemptFeature).filter(AttemptFeature.attempt_id == attempt.id).first()
    if feature is None:
        feature = AttemptFeature(attempt_id=attempt.id)

    feature_values: dict[str, Any] = {
        "assessment_id": str(assessment.id),
        "subject": str(assessment.subject or "Unknown"),
        "avg_time": round(avg_time, 4),
        "time_variance": round(time_variance, 4),
        "revision_count": int(revision_count),
        "wr_ratio": round(wr_ratio, 4),
        "rw_ratio": round(rw_ratio, 4),
        "navigation_count": int(navigation_count),
        "rte_score": round(rte_score, 4),
        "accuracy": round(accuracy, 4),
        "behavior_label": behavior_label,
        "label_source": label_source,
        "unsupervised_cluster": unsupervised_cluster,
        "unsupervised_distance": unsupervised_distance,
    }
    for field_name, field_value in feature_values.items():
        setattr(feature, field_name, field_value)

    db.add(feature)
    db.flush()
    return feature
