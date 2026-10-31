import os
import sys
from datetime import datetime, timezone, timedelta

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.config import settings
from api.database import Base, SessionLocal, migration_engine, run_migrations
from api.models import AdminUser, Event, GuestRSVP
from api.auth import hash_password
from api.tokens import generate_invite_token


def init_database():
    print(f"[Ma5sos] Connecting to database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    Base.metadata.create_all(bind=migration_engine)
    run_migrations()
    print("[Ma5sos] Database tables created / verified successfully.")

    db = SessionLocal()
    try:
        admin_email = settings.ADMIN_EMAIL.strip().lower()
        existing = db.query(AdminUser).filter(AdminUser.email == admin_email).first()
        if not existing:
            admin = AdminUser(
                email=admin_email,
                name=settings.ADMIN_NAME,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                is_active=True,
                has_paid=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"[Ma5sos] Admin account initialized: {admin_email}")
        else:
            admin = existing
            if not admin.has_paid:
                admin.has_paid = True
                db.commit()
            print(f"[Ma5sos] Admin account already exists: {admin_email}")

        if db.query(Event).count() == 0:
            now_utc = datetime.now(timezone.utc)
            demo_event = Event(
                user_id=admin.id,
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

            sample_rsvp1 = GuestRSVP(
                event_id=demo_event.id,
                guest_name="سلطان الحربي",
                phone="+966501234567",
                status="confirmed",
                companions_count=2,
                qr_code="QR-MK-DEMO-01",
                invite_token=generate_invite_token(),
                notes="ألف مبروك وبالرفاه والبنين يا رب",
                checked_in=True,
                checked_in_at=now_utc,
            )
            sample_rsvp2 = GuestRSVP(
                event_id=demo_event.id,
                guest_name="محمد العمري",
                phone="+966559876543",
                status="confirmed",
                companions_count=1,
                qr_code="QR-MK-DEMO-02",
                invite_token=generate_invite_token(),
                notes="يسعدني الحضور والمشاركة في فرحتكم",
                checked_in=False,
            )
            sample_rsvp3 = GuestRSVP(
                event_id=demo_event.id,
                guest_name="خالد التميمي",
                phone="+966543322114",
                status="declined",
                companions_count=0,
                qr_code="QR-MK-DEMO-03",
                invite_token=generate_invite_token(),
                notes="أبارك لكم من القلب وأعتذر لتواجدي خارج المملكة",
                checked_in=False,
            )
            db.add_all([sample_rsvp1, sample_rsvp2, sample_rsvp3])
            db.commit()
            print("[Ma5sos] Demo events seeded successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    init_database()
