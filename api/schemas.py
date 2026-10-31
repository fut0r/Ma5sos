import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_serializer, model_validator

from api.config import settings
from api.dates import as_utc


# ---------- Accounts ----------

class AdminLogin(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str = Field(..., min_length=6)


class AccountRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(..., min_length=8, max_length=128)


class FirebaseLogin(BaseModel):
    """A phone-verified Firebase ID token, plus the name on first sign-up."""

    idToken: str = Field(..., min_length=20)
    name: Optional[str] = Field(None, max_length=100)


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    phone: Optional[str] = None
    is_active: bool = True
    has_paid: bool = False
    plan_id: Optional[str] = None
    created_at: Optional[datetime.datetime] = None

    @computed_field
    @property
    def is_admin(self) -> bool:
        return self.email.strip().lower() in {
            settings.ADMIN_EMAIL.strip().lower(),
            "admin@ma5sos.com",
            "admin@mazom.net",
        }


class AdminToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AdminUserOut


# ---------- Guests & RSVP ----------

class GuestRSVPBase(BaseModel):
    guest_name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., min_length=6, max_length=50)
    status: str = Field("confirmed", pattern="^(confirmed|declined|pending)$")
    companions_count: int = Field(0, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=2000)


class GuestRSVPCreate(GuestRSVPBase):
    """Accepts both ``companions_count`` (API) and ``companion_count`` (legacy)."""

    companion_count: Optional[int] = Field(None, ge=0, le=20)

    @model_validator(mode="after")
    def _legacy_companion_count(self):
        if self.companion_count is not None:
            self.companions_count = self.companion_count
        return self


class GuestInviteCreate(BaseModel):
    """A guest the host adds before sending a private invitation link."""

    guest_name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., min_length=6, max_length=50)
    companions_count: int = Field(0, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=2000)


class GuestInviteUpdate(BaseModel):
    guest_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, min_length=6, max_length=50)
    companions_count: Optional[int] = Field(None, ge=0, le=10)
    notes: Optional[str] = Field(None, max_length=2000)


class GuestRSVPOut(GuestRSVPBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    qr_code: str
    invite_token: Optional[str] = None
    checked_in: bool = False
    checked_in_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None

    @field_serializer("checked_in_at", "created_at")
    def _utc_times(self, value: Optional[datetime.datetime]):
        return as_utc(value)

    @computed_field
    @property
    def qr_token(self) -> str:
        return self.qr_code

    @computed_field
    @property
    def qr_payload(self) -> str:
        return f"MA5SOS:TICKET:{self.qr_code}"

    @computed_field
    @property
    def companion_count(self) -> int:
        return self.companions_count


class CheckInRequest(BaseModel):
    qr_token: Optional[str] = None
    qr_code: Optional[str] = None
    guest_id: Optional[int] = None
    rsvp_id: Optional[int] = None


# ---------- Events ----------

class EventBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    occasion_type: str = Field("wedding", max_length=50)
    host_name: str = Field(..., min_length=2, max_length=150)
    honoree_name: Optional[str] = None
    event_date: datetime.datetime
    event_time: Optional[str] = None
    venue_name: str = Field(..., min_length=2, max_length=200)
    venue_address: Optional[str] = None
    location_url: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    template_id: str = "andalusian"
    is_public: bool = True
    max_guests: int = Field(100, ge=1, le=5000)


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = None
    occasion_type: Optional[str] = None
    host_name: Optional[str] = None
    honoree_name: Optional[str] = None
    event_date: Optional[datetime.datetime] = None
    event_time: Optional[str] = None
    venue_name: Optional[str] = None
    venue_address: Optional[str] = None
    location_url: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    template_id: Optional[str] = None
    is_public: Optional[bool] = None
    max_guests: Optional[int] = Field(None, ge=1, le=5000)


class EventOut(EventBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    share_code: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    total_rsvps: int = 0
    confirmed_count: int = 0
    declined_count: int = 0
    total_guests: int = 0
    rsvps: Optional[List[GuestRSVPOut]] = None

    @field_serializer("event_date", "created_at", "updated_at")
    def _utc_times(self, value: Optional[datetime.datetime]):
        return as_utc(value)


# ---------- Public invitation ----------

class PublicInvitationOut(BaseModel):
    title: str
    occasion_type: str
    host_name: str
    honoree_name: Optional[str] = None
    event_date: datetime.datetime
    event_time: Optional[str] = None
    venue_name: str
    venue_address: Optional[str] = None
    location_url: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    template_id: str
    share_code: str
    max_guests: int
    confirmed_count: int = 0
    attending_count: int = 0

    @field_serializer("event_date")
    def _utc_event_date(self, value: Optional[datetime.datetime]):
        return as_utc(value)


class PrivateGuestOut(BaseModel):
    """The guest data revealed only by that guest's private link."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    guest_name: str
    phone: str
    status: str
    companions_count: int
    notes: Optional[str] = None
    qr_code: Optional[str] = None
    checked_in: bool = False
    checked_in_at: Optional[datetime.datetime] = None

    @field_serializer("checked_in_at")
    def _utc_checked_in(self, value: Optional[datetime.datetime]):
        return as_utc(value)

    @computed_field
    @property
    def companion_count(self) -> int:
        return self.companions_count

    @computed_field
    @property
    def qr_payload(self) -> Optional[str]:
        return f"MA5SOS:TICKET:{self.qr_code}" if self.qr_code else None


class PrivateInvitationOut(PublicInvitationOut):
    guest: PrivateGuestOut


class GuestRespondRequest(BaseModel):
    guest_name: str = Field(..., min_length=2, max_length=150)
    status: str = Field(..., pattern="^(confirmed|declined)$")


class RSVPResponseOut(BaseModel):
    ok: bool = True
    success: bool = True
    message: str
    rsvp: GuestRSVPOut
    event_title: str
    event_date: Optional[datetime.datetime] = None
    event_time: Optional[str] = None
    venue_name: Optional[str] = None
    host_name: Optional[str] = None

    @field_serializer("event_date")
    def _utc_event_date(self, value: Optional[datetime.datetime]):
        return as_utc(value)


# ---------- Orders ----------

class OrderOut(BaseModel):
    orderNumber: str
    planId: str
    amount: float
    status: str
    paymentMethod: Optional[str] = None
    createdAt: Optional[datetime.datetime] = None
    paidAt: Optional[datetime.datetime] = None

    @field_serializer("createdAt", "paidAt")
    def _utc_times(self, value: Optional[datetime.datetime]):
        return as_utc(value)


class OrderCreate(BaseModel):
    planId: str


# ---------- Stats ----------

class DashboardStats(BaseModel):
    total_events: int
    total_guests: int
    confirmed_guests: int
    declined_guests: int
    upcoming_events: int
