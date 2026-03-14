from pathlib import Path
from uuid import uuid4
from fastapi import HTTPException, UploadFile

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _uploads_root() -> Path:
    return Path(__file__).resolve().parents[3] / "uploads"


def save_image_upload(file: UploadFile, category: str) -> str:
    content_type = (file.content_type or "").lower()
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if not extension:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WEBP images are allowed")

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image size must be 5MB or less")

    uploads_root = _uploads_root()
    target_dir = uploads_root / category
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{extension}"
    file_path = target_dir / filename
    file_path.write_bytes(content)

    return f"/uploads/{category}/{filename}"


def delete_uploaded_file(file_path: str | None) -> None:
    if not file_path:
        return
    if not file_path.startswith("/uploads/"):
        return

    relative_path = file_path.replace("/uploads/", "", 1)
    absolute_path = (_uploads_root() / relative_path).resolve()
    root = _uploads_root().resolve()

    if root not in absolute_path.parents and absolute_path != root:
        return

    if absolute_path.exists() and absolute_path.is_file():
        absolute_path.unlink()
