from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from api.auth import get_current_admin
from api.config import settings
from api.database import get_db
from api.models import AdminUser, Event, GuestRSVP
from api.schemas import DashboardStats

router = APIRouter(prefix="/stats", tags=["Dashboard Statistics"])


def _is_super_admin(admin: AdminUser) -> bool:
    return admin.email.strip().lower() in {
        settings.ADMIN_EMAIL.strip().lower(),
        "admin@ma5sos.com",
        "admin@mazom.net",
    }


def _event_scope(admin: AdminUser):
    if _is_super_admin(admin):
        return or_(Event.user_id == admin.id, Event.user_id.is_(None))
    return Event.user_id == admin.id


@router.get("", response_model=DashboardStats)
def get_dashboard_stats(
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    scope = _event_scope(admin)

    total_events = db.query(Event).filter(scope).count()
    total_guests = db.query(GuestRSVP).join(Event).filter(scope).count()
    confirmed_guests = (
        db.query(GuestRSVP)
        .join(Event)
        .filter(scope, GuestRSVP.status == "confirmed")
        .count()
    )
    declined_guests = (
        db.query(GuestRSVP)
        .join(Event)
        .filter(scope, GuestRSVP.status == "declined")
        .count()
    )
    upcoming_events = (
        db.query(Event).filter(scope, Event.event_date >= now).count()
    )

    return DashboardStats(
        total_events=total_events,
        total_guests=total_guests,
        confirmed_guests=confirmed_guests,
        declined_guests=declined_guests,
        upcoming_events=upcoming_events,
    )
