from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session


def get_next_display_counter(
    db: Session,
    model,
    column_name: str,
    prefix: str,
) -> int:
    column = getattr(model, column_name)
    numeric_part = cast(func.substring(column, len(prefix) + 1), Integer)

    max_value = (
        db.query(func.max(numeric_part))
        .filter(column.like(f"{prefix}%"))
        .scalar()
    )

    return int(max_value or 0) + 1


def format_display_code(prefix: str, value: int, width: int = 6) -> str:
    return f"{prefix}{value:0{width}d}"


def generate_next_display_code(
    db: Session,
    model,
    column_name: str,
    prefix: str,
    width: int = 6,
) -> str:
    next_value = get_next_display_counter(db, model, column_name, prefix)
    return f"{prefix}{next_value:0{width}d}"
