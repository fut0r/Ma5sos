import os
import secrets
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from api.config import settings


def _normalize_db_url(raw_url: str) -> str:
    """Normalize PostgreSQL URLs for SQLAlchemy with the modern psycopg driver."""
    if raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+psycopg://", 1)
    if raw_url.startswith("postgresql://") and not raw_url.startswith("postgresql+"):
        return raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return raw_url


raw_url = settings.DATABASE_URL.strip()
db_url = _normalize_db_url(raw_url)
is_vercel = bool(os.getenv("VERCEL"))
is_sqlite = db_url.startswith("sqlite")

if is_sqlite:
    if is_vercel:
        db_url = "sqlite:////tmp/ma5sos.db"
    else:
        file_path = db_url.replace("sqlite:///", "")
        if "/" in file_path or "\\" in file_path:
            dir_name = os.path.dirname(file_path)
            if dir_name:
                try:
                    os.makedirs(dir_name, exist_ok=True)
                except OSError:
                    pass
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
    )
    migration_engine = engine
else:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
        connect_args={"prepare_threshold": None},
    )

    unpooled_raw_url = (settings.DATABASE_URL_UNPOOLED or "").strip()
    if unpooled_raw_url and unpooled_raw_url != raw_url:
        migration_engine = create_engine(
            _normalize_db_url(unpooled_raw_url),
            pool_pre_ping=True,
            poolclass=NullPool,
            connect_args={"prepare_threshold": None},
        )
    else:
        migration_engine = engine

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

_initialized = False


def _table_columns(table_name: str) -> set[str]:
    inspector = inspect(migration_engine)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_column(table_name: str, column_name: str, ddl: str) -> None:
    """Adds one column when it is missing, so old deployments keep their data."""
    if column_name in _table_columns(table_name):
        return
    with migration_engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}"))


def _execute(sql: str) -> None:
    with migration_engine.begin() as connection:
        connection.execute(text(sql))


def run_migrations() -> None:
    """Idempotent schema upgrades for databases created by older releases."""
    _add_column("admin_users", "phone", "VARCHAR(32)")
    _add_column("admin_users", "has_paid", "BOOLEAN NOT NULL DEFAULT FALSE")
    _add_column("admin_users", "plan_id", "VARCHAR(32)")

    _add_column("events", "user_id", "INTEGER")

    _add_column("guest_rsvps", "companions_count", "INTEGER NOT NULL DEFAULT 0")
    _add_column("guest_rsvps", "qr_code", "VARCHAR(64)")
    _add_column("guest_rsvps", "checked_in", "BOOLEAN NOT NULL DEFAULT FALSE")
    _add_column("guest_rsvps", "checked_in_at", "TIMESTAMP")
    _add_column("guest_rsvps", "invite_token", "VARCHAR(64)")

    _add_column("orders", "transaction_no", "VARCHAR(128)")
    _add_column("orders", "payment_url", "TEXT")
    _add_column("orders", "payment_method", "VARCHAR(64)")
    _add_column("orders", "paid_at", "TIMESTAMP")

    guest_columns = _table_columns("guest_rsvps")
    if guest_columns:
        if "companion_count" in guest_columns:
            _execute(
                "UPDATE guest_rsvps SET companions_count = companion_count "
                "WHERE (companions_count IS NULL OR companions_count = 0) AND companion_count > 0"
            )
        if "qr_code" in guest_columns:
            _execute(
                "UPDATE guest_rsvps SET qr_code = 'QR-LEGACY-' || CAST(id AS VARCHAR) "
                "WHERE qr_code IS NULL OR TRIM(qr_code) = ''"
            )
        _execute("UPDATE guest_rsvps SET companions_count = 0 WHERE companions_count IS NULL")

        if "invite_token" in guest_columns:
            with migration_engine.begin() as connection:
                rows = connection.execute(
                    text("SELECT id, invite_token FROM guest_rsvps")
                ).fetchall()
                used = {str(row[1]) for row in rows if row[1]}
                for guest_id, token in rows:
                    if token and str(token).strip():
                        continue
                    fresh = secrets.token_urlsafe(24)
                    while fresh in used:
                        fresh = secrets.token_urlsafe(24)
                    used.add(fresh)
                    connection.execute(
                        text("UPDATE guest_rsvps SET invite_token = :token WHERE id = :guest_id"),
                        {"token": fresh, "guest_id": guest_id},
                    )
            _execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_guest_rsvps_invite_token "
                "ON guest_rsvps (invite_token)"
            )

    admin_columns = _table_columns("admin_users")
    if {"email", "has_paid"}.issubset(admin_columns):
        email = settings.ADMIN_EMAIL.strip().lower().replace("'", "''")
        _execute(
            f"UPDATE admin_users SET has_paid = TRUE "
            f"WHERE LOWER(email) IN ('{email}', 'admin@ma5sos.com', 'admin@mazom.net') "
            f"AND (has_paid IS NULL OR has_paid = FALSE)"
        )


def ensure_db_initialized():
    """Ensures database tables and default admin exist."""
    global _initialized
    if _initialized:
        return
    try:
        from api.models import AdminUser, Event, GuestRSVP
        from api.auth import hash_password
        from api.tokens import generate_invite_token
        from datetime import datetime, timezone, timedelta

        Base.metadata.create_all(bind=migration_engine)
        run_migrations()

        db = SessionLocal()
        try:
            admin = db.query(AdminUser).order_by(AdminUser.id.asc()).first()
            if admin is None and settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
                admin = AdminUser(
                    email=settings.ADMIN_EMAIL.strip().lower(),
                    name=settings.ADMIN_NAME,
                    password_hash=hash_password(settings.ADMIN_PASSWORD),
                    is_active=True,
                    has_paid=True,
                )
                db.add(admin)
                db.commit()
                db.refresh(admin)

            event_count = db.query(Event).count()
            if event_count == 0:
                now_utc = datetime.now(timezone.utc)
                demo_event = Event(
                    user_id=admin.id if admin else None,
                    title="حفل زفاف فيصل بن عبدالله",
                    occasion_type="wedding",
                    host_name="عبدالله بن عبدالعزيز القحطاني",
                    honoree_name="فيصل",
                    event_date=now_utc + timedelta(days=14),
                    event_time="8:30 مساءً",
                    venue_name="قاعة ليلتي للاحتفالات، الرياض",
                    venue_address="حي النرجس، طريق الملك سلمان",
                    location_url="https://maps.google.com/?q=24.8456,46.6853",
                    description="يتشرف عبدالله بن عبدالعزيز القحطاني بدعوتكم لحضور حفل زفاف ابنه فيصل، وبحضوركم تكتمل بهجتنا وفرحتنا.",
                    notes="جنة الأطفال منازلهم · نرجو إبراز رمز QR عند المدخل",
                    template_id="andalusian",
                    share_code="MK-DEMO-2026",
                    is_public=True,
                    max_guests=150,
                )
                db.add(demo_event)
                db.commit()
                db.refresh(demo_event)

                sample_rsvp = GuestRSVP(
                    event_id=demo_event.id,
                    guest_name="سلطان الحربي",
                    phone="+966501112233",
                    status="confirmed",
                    companions_count=1,
                    notes="ألف مبروك وبالرفاه والبنين",
                    qr_code="QR-DEMO-SULTAN",
                    invite_token=generate_invite_token(),
                    checked_in=False,
                )
                db.add(sample_rsvp)
                db.commit()
            _initialized = True
        finally:
            db.close()
    except Exception as e:
        print(f"[Ma5sos DB Init Warning]: {e}")


def get_db():
    ensure_db_initialized()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
