from app.db.init_db import init_db
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import AuthProviderEnum, RoleEnum, User


ADMIN_NAME = "admin"
ADMIN_EMAIL = "admin@cusat.ac.in"
ADMIN_PASSWORD = "admHck@123"


def seed_admin() -> None:
    init_db()
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == ADMIN_EMAIL).first()

        if admin:
            admin.name = ADMIN_NAME
            admin.role = RoleEnum.admin
            admin.auth_provider = AuthProviderEnum.local
            admin.provider_id = None
            admin.password_hash = hash_password(ADMIN_PASSWORD)
            db.commit()
            print(f"Updated existing admin: {ADMIN_EMAIL}")
            return

        admin = User(
            name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            role=RoleEnum.admin,
            auth_provider=AuthProviderEnum.local,
            provider_id=None,
        )
        db.add(admin)
        db.commit()
        print(f"Created admin: {ADMIN_EMAIL}")
    except Exception as exc:
        db.rollback()
        raise RuntimeError(f"Failed to seed admin user: {exc}") from exc
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
