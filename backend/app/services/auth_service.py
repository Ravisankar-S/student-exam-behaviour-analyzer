from sqlalchemy.orm import Session
from app.models.user import User, AuthProviderEnum
from app.core.security import hash_password, verify_password, create_access_token

def register_user(db: Session, name: str, email: str, password: str, role: str):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        auth_provider=AuthProviderEnum.local
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role
    })

    return token