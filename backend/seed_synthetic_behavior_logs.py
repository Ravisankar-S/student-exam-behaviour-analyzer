import argparse
import random
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from app.core.security import hash_password
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.models.assessment import Assessment
from app.models.attempt import Attempt
from app.models.attempt_feature import AttemptFeature
from app.models.event_log import EventLog
from app.models.question import Question
from app.models.student_profile import StudentProfile
from app.models.user import AuthProviderEnum, RoleEnum, User
from app.services.attempt_feature_service import compute_and_store_attempt_features
from app.services.display_code_service import (
    format_display_code,
    generate_next_display_code,
    get_next_display_counter,
)


PROFILE_NAMES = [
    "Fast-Response",
    "Deliberative",
    "High-Revision",
    "Inconsistent",
    "Disengaged",
    "Reviewer",
]

SEED_ASSESSMENT_TITLE = "Behavioral Analytics Seed Test (10Q)"
SYNTHETIC_EMAIL_PATTERN = "synthetic.%@seed.local"


class EventBuilder:
    def __init__(self, question_ids: list[str], start_time: datetime):
        self.question_ids = question_ids
        self.current_time = start_time
        self.events: list[dict[str, Any]] = []
        self.visit_index_by_question: dict[str, int] = {qid: 0 for qid in question_ids}
        self.last_selected_by_question: dict[str, str] = {}

    def add(self, question_id: str, time_spent_sec: float, selected_option: str):
        self.visit_index_by_question[question_id] += 1
        visit_index = self.visit_index_by_question[question_id]
        previous = self.last_selected_by_question.get(question_id)
        answer_changed = previous is not None and selected_option != previous

        event_time = self.current_time + timedelta(seconds=float(time_spent_sec))
        self.current_time = event_time + timedelta(seconds=1)

        self.events.append(
            {
                "question_id": question_id,
                "timestamp": event_time,
                "time_spent_sec": float(round(time_spent_sec, 3)),
                "selected_option": selected_option,
                "answer_changed": bool(answer_changed),
                "visit_index": int(visit_index),
            }
        )
        self.last_selected_by_question[question_id] = selected_option



def pick_wrong_letter(correct_letter: str, rng: random.Random) -> str:
    choices = ["A", "B", "C", "D"]
    choices.remove(correct_letter)
    return rng.choice(choices)



def build_profile_events(
    profile: str,
    question_ids: list[str],
    correct_letters: dict[str, str],
    rng: random.Random,
) -> list[dict[str, Any]]:
    builder = EventBuilder(question_ids, datetime.utcnow())

    def select_correct_or_wrong(qid: str, correct_probability: float) -> str:
        correct = rng.random() < correct_probability
        return correct_letters[qid] if correct else pick_wrong_letter(correct_letters[qid], rng)

    if profile == "Fast-Response":
        for qid in question_ids:
            builder.add(qid, rng.uniform(6.2, 11.5), select_correct_or_wrong(qid, 0.75))

    elif profile == "Deliberative":
        for qid in question_ids:
            builder.add(qid, rng.uniform(22.0, 34.0), select_correct_or_wrong(qid, 0.70))

        for qid in rng.sample(question_ids, k=2):
            previous = builder.last_selected_by_question[qid]
            next_choice = pick_wrong_letter(previous, rng)
            builder.add(qid, rng.uniform(18.0, 26.0), next_choice)

    elif profile == "High-Revision":
        for qid in question_ids:
            builder.add(qid, rng.uniform(10.0, 20.0), select_correct_or_wrong(qid, 0.55))

        round_two = rng.sample(question_ids, k=6)
        for qid in round_two:
            previous = builder.last_selected_by_question[qid]
            builder.add(qid, rng.uniform(8.0, 16.0), pick_wrong_letter(previous, rng))

        round_three = rng.sample(round_two, k=3)
        for qid in round_three:
            previous = builder.last_selected_by_question[qid]
            builder.add(qid, rng.uniform(6.0, 14.0), pick_wrong_letter(previous, rng))

    elif profile == "Inconsistent":
        high = [42.0, 50.0, 56.0, 46.0, 52.0]
        low = [3.0, 4.0, 5.0, 4.5, 3.8]
        pattern = []
        for i in range(len(question_ids)):
            pattern.append(high[i // 2] if i % 2 else low[i // 2])

        for idx, qid in enumerate(question_ids):
            builder.add(qid, pattern[idx], select_correct_or_wrong(qid, 0.60))

    elif profile == "Disengaged":
        for qid in question_ids:
            builder.add(qid, rng.uniform(2.2, 4.8), select_correct_or_wrong(qid, 0.20))

    elif profile == "Reviewer":
        for qid in question_ids:
            builder.add(qid, rng.uniform(6.5, 10.0), select_correct_or_wrong(qid, 0.65))

        revisit_ids = rng.sample(question_ids, k=6)
        for qid in revisit_ids:
            previous = builder.last_selected_by_question[qid]
            builder.add(qid, rng.uniform(14.0, 22.0), previous)

        revision_ids = rng.sample(revisit_ids, k=3)
        for qid in revision_ids:
            previous = builder.last_selected_by_question[qid]
            builder.add(qid, rng.uniform(10.0, 18.0), pick_wrong_letter(previous, rng))

    else:
        raise ValueError(f"Unknown profile: {profile}")

    return builder.events



def build_correct_letter_map(questions: list[Question]) -> dict[str, str]:
    letter_map: dict[str, str] = {}
    for question in questions:
        correct_option = next((option for option in question.options if option.is_correct), None)
        if not correct_option:
            raise ValueError(f"Question {question.id} has no correct option")
        idx = int(correct_option.order_index or 0)
        if idx < 0 or idx > 3:
            raise ValueError(f"Question {question.id} has invalid correct option index")
        letter_map[str(question.id)] = chr(65 + idx)
    return letter_map



def latest_answer_by_question(events: list[dict[str, Any]]) -> dict[str, str]:
    ordered = sorted(events, key=lambda item: (item["timestamp"], item["visit_index"]))
    latest: dict[str, str] = {}
    for event in ordered:
        latest[event["question_id"]] = event["selected_option"]
    return latest



def ensure_synthetic_student(db, profile: str, serial_no: int) -> User:
    safe_profile = profile.lower().replace("-", "").replace(" ", "")
    email = f"synthetic.{safe_profile}.{serial_no:03d}@seed.local"
    name = f"Synthetic {profile} {serial_no:03d}"

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password("synth@123"),
            role=RoleEnum.student,
            auth_provider=AuthProviderEnum.local,
            provider_id=None,
        )
        db.add(user)
        db.flush()

    user_updates = {
        "name": name,
        "role": RoleEnum.student,
        "auth_provider": AuthProviderEnum.local,
        "provider_id": None,
    }
    for field_name, field_value in user_updates.items():
        setattr(user, field_name, field_value)

    profile_row = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    if profile_row is None:
        profile_row = StudentProfile(user_id=user.id)
        db.add(profile_row)

    if not str(getattr(profile_row, "reg_no", "") or "").strip():
        setattr(profile_row, "reg_no", f"SYN-{safe_profile[:6].upper()}-{serial_no:03d}")
    if not str(getattr(profile_row, "department", "") or "").strip():
        setattr(profile_row, "department", "Synthetic")
    if getattr(profile_row, "semester", None) is None:
        setattr(profile_row, "semester", 6)

    return user



def resolve_assessment(db, assessment_code: str | None) -> Assessment:
    if assessment_code:
        row = db.query(Assessment).filter(Assessment.assessment_code == assessment_code).first()
        if row is None:
            raise ValueError(f"Assessment not found for code {assessment_code}")
        return row

    seeded = db.query(Assessment).filter(Assessment.title == SEED_ASSESSMENT_TITLE).first()
    if seeded is not None:
        return seeded

    fallback = db.query(Assessment).order_by(Assessment.created_at.desc()).first()
    if fallback is None:
        raise ValueError("No assessment found. Seed/create an assessment first.")
    return fallback


def reset_dataset(db):
    synthetic_students = db.query(User).filter(User.email.like(SYNTHETIC_EMAIL_PATTERN)).all()
    synthetic_student_ids = [row.id for row in synthetic_students]

    deleted_features = db.query(AttemptFeature).delete(synchronize_session=False)
    deleted_events = db.query(EventLog).delete(synchronize_session=False)
    deleted_attempts = db.query(Attempt).delete(synchronize_session=False)

    deleted_profiles = 0
    deleted_students = 0
    if synthetic_student_ids:
        deleted_profiles = (
            db.query(StudentProfile)
            .filter(StudentProfile.user_id.in_(synthetic_student_ids))
            .delete(synchronize_session=False)
        )
        deleted_students = (
            db.query(User)
            .filter(User.id.in_(synthetic_student_ids))
            .delete(synchronize_session=False)
        )

    db.commit()
    return {
        "attempt_features": int(deleted_features or 0),
        "event_logs": int(deleted_events or 0),
        "attempts": int(deleted_attempts or 0),
        "student_profiles": int(deleted_profiles or 0),
        "students": int(deleted_students or 0),
    }



def persist_synthetic_attempt(
    db,
    assessment: Assessment,
    questions: list[Question],
    student: User,
    events: list[dict[str, Any]],
    correct_letters: dict[str, str],
):
    ordered_events = sorted(events, key=lambda item: (item["timestamp"], item["visit_index"]))
    started_at = ordered_events[0]["timestamp"] - timedelta(seconds=1)
    submitted_at = ordered_events[-1]["timestamp"] + timedelta(seconds=1)

    final_answers = latest_answer_by_question(ordered_events)
    correct_count = sum(1 for qid, letter in final_answers.items() if correct_letters.get(qid) == letter)
    score = round((correct_count / len(questions)) * 100, 2)

    attempt = Attempt(
        attempt_code=generate_next_display_code(db, Attempt, "attempt_code", "A", 6),
        assessment_id=assessment.id,
        student_id=student.id,
        started_at=started_at,
        submitted_at=submitted_at,
        score=score,
    )
    db.add(attempt)
    db.flush()

    next_event_code_counter = get_next_display_counter(db, EventLog, "event_code", "E")
    event_models: list[EventLog] = []
    for event in ordered_events:
        event_models.append(
            EventLog(
                event_code=format_display_code("E", next_event_code_counter, 6),
                attempt_id=attempt.id,
                student_id=student.id,
                question_id=event["question_id"],
                timestamp=event["timestamp"],
                time_spent_sec=event["time_spent_sec"],
                selected_option=event["selected_option"],
                answer_changed=event["answer_changed"],
                visit_index=event["visit_index"],
            )
        )
        next_event_code_counter += 1

    db.add_all(event_models)
    feature = compute_and_store_attempt_features(
        db=db,
        attempt=attempt,
        assessment=assessment,
        questions=questions,
        event_logs=event_models,
        correct_count=correct_count,
    )
    db.commit()

    return {
        "attempt_code": attempt.attempt_code,
        "score": score,
        "events": len(event_models),
        "label": feature.behavior_label,
    }



def seed_synthetic_behavior_logs(
    attempts_per_profile: int,
    assessment_code: str | None,
    seed_value: int,
    reset_existing: bool,
):
    init_db()
    db = SessionLocal()
    rng = random.Random(seed_value)

    try:
        reset_stats = None
        if reset_existing:
            reset_stats = reset_dataset(db)

        assessment = resolve_assessment(db, assessment_code)
        questions = (
            db.query(Question)
            .filter(Question.assessment_id == assessment.id)
            .order_by(Question.order_index.asc(), Question.created_at.asc())
            .all()
        )
        if len(questions) < 4:
            raise ValueError("Assessment must have at least 4 questions for meaningful profile synthesis")

        correct_letters = build_correct_letter_map(questions)

        rows = []
        assigned_counts = Counter()
        for profile in PROFILE_NAMES:
            for serial in range(1, attempts_per_profile + 1):
                student = ensure_synthetic_student(db, profile, serial)
                events = build_profile_events(profile, [str(q.id) for q in questions], correct_letters, rng)
                result = persist_synthetic_attempt(db, assessment, questions, student, events, correct_letters)
                assigned_counts[result["label"]] += 1
                rows.append((profile, result["attempt_code"], result["label"], result["events"], result["score"]))

        print("Synthetic behavior seed complete.")
        print(f"Assessment: {assessment.assessment_code} - {assessment.title}")
        if reset_stats is not None:
            print("Reset stats before generation:")
            print(
                "  "
                f"attempt_features={reset_stats['attempt_features']}, "
                f"event_logs={reset_stats['event_logs']}, "
                f"attempts={reset_stats['attempts']}, "
                f"student_profiles={reset_stats['student_profiles']}, "
                f"students={reset_stats['students']}"
            )
        print(f"Attempts generated: {len(rows)}")
        print("Assigned behavior label counts:")
        for label, count in sorted(assigned_counts.items()):
            print(f"  {label}: {count}")

        print("\nSample rows (first 12):")
        for row in rows[:12]:
            print(f"  intended={row[0]:14} attempt={row[1]} assigned={row[2]:14} events={row[3]:2} score={row[4]:5.1f}")

    except Exception as exc:
        db.rollback()
        raise RuntimeError(f"Failed to seed synthetic behavior logs: {exc}") from exc
    finally:
        db.close()



def main():
    parser = argparse.ArgumentParser(description="Seed synthetic event logs for behavior profiles")
    parser.add_argument("--attempts-per-profile", type=int, default=50, help="Number of attempts to generate for each profile")
    parser.add_argument("--assessment-code", type=str, default=None, help="Target assessment_code (optional)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--no-reset", action="store_true", help="Do not clear existing generated dataset before inserting")
    args = parser.parse_args()

    seed_synthetic_behavior_logs(
        attempts_per_profile=max(1, args.attempts_per_profile),
        assessment_code=args.assessment_code,
        seed_value=args.seed,
        reset_existing=not args.no_reset,
    )


if __name__ == "__main__":
    main()
