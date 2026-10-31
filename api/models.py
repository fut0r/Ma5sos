from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from api.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(32), unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    has_paid = Column(Boolean, default=False, nullable=False)
    plan_id = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    occasion_type = Column(String(50), nullable=False, default="wedding")
    host_name = Column(String(150), nullable=False)
    honoree_name = Column(String(150), nullable=True)
    event_date = Column(DateTime, nullable=False)
    event_time = Column(String(50), nullable=True)
    venue_name = Column(String(200), nullable=False)
    venue_address = Column(String(255), nullable=True)
    location_url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    template_id = Column(String(100), default="andalusian", nullable=False)
    share_code = Column(String(64), unique=True, index=True, nullable=False)
    is_public = Column(Boolean, default=True, nullable=False)
    max_guests = Column(Integer, default=100, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    rsvps = relationship(
        "GuestRSVP",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="GuestRSVP.created_at.desc()",
    )


class GuestRSVP(Base):
    __tablename__ = "guest_rsvps"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    guest_name = Column(String(150), nullable=False)
    phone = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="confirmed")  # confirmed, declined, pending
    companions_count = Column(Integer, default=0, nullable=False)
    qr_code = Column(String(64), unique=True, index=True, nullable=False)
    # The host creates the guest and sends this token in a private link.  It is
    # nullable only for rows written before private invitations existed; the
    # startup migration backfills every old row.
    invite_token = Column(String(64), unique=True, index=True, nullable=True)
    notes = Column(Text, nullable=True)
    checked_in = Column(Boolean, default=False, nullable=False)
    checked_in_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    event = relationship("Event", back_populates="rsvps")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, nullable=False, index=True)
    plan_id = Column(String(32), nullable=False)
    amount = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="pending")  # pending | paid | canceled
    transaction_no = Column(String(128), nullable=True)
    payment_url = Column(Text, nullable=True)
    payment_method = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    paid_at = Column(DateTime, nullable=True)
