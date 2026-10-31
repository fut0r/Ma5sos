from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.dates import as_utc
from api.database import get_db
from api.models import Event, GuestRSVP
from api.phone import normalize_saudi_mobile, phone_variants
from api.schemas import (
    GuestRespondRequest,
    GuestRSVPCreate,
    GuestRSVPOut,
    PrivateGuestOut,
    PrivateInvitationOut,
    PublicInvitationOut,
    RSVPResponseOut,
)
from api.tokens import generate_invite_token, generate_qr_code

router = APIRouter(prefix="/public", tags=["Public Invitation & RSVP"])


def _find_event(db: Session, share_code: str) -> Event | None:
    code = (share_code or "").strip()
    if not code:
        return None
    event = db.query(Event).filter(func.upper(Event.share_code) == code.upper()).first()
    return event


def _attending_count(event: Event) -> int:
    return sum(
        (rsvp.companions_count or 0) + 1 for rsvp in event.rsvps if rsvp.status == "confirmed"
    )


def _reserved_count(event: Event, exclude_id: int | None = None) -> int:
    """Pending and confirmed guests hold a seat; decliners release it."""
    return sum(
        (rsvp.companions_count or 0) + 1
        for rsvp in event.rsvps
        if rsvp.status != "declined" and rsvp.id != exclude_id
    )


def _find_guest_by_token(db: Session, event: Event, invite_token: str) -> GuestRSVP | None:
    token = (invite_token or "").strip()
    if not token:
        return None
    return (
        db.query(GuestRSVP)
        .filter(GuestRSVP.event_id == event.id, GuestRSVP.invite_token == token)
        .first()
    )


def _private_guest_payload(guest: GuestRSVP) -> PrivateGuestOut:
    payload = PrivateGuestOut.model_validate(guest)
    if guest.status != "confirmed":
        payload.qr_code = None
    return payload


def _unique_invite_token(db: Session) -> str:
    token = generate_invite_token()
    while db.query(GuestRSVP).filter(GuestRSVP.invite_token == token).first():
        token = generate_invite_token()
    return token


def _guest_payload(rsvp: GuestRSVP, event: Event) -> dict:
    return {
        "id": rsvp.id,
        "event_id": event.id,
        "guest_name": rsvp.guest_name,
        "phone": rsvp.phone,
        "status": rsvp.status,
        "companions_count": rsvp.companions_count or 0,
        "companion_count": rsvp.companions_count or 0,
        "qr_code": rsvp.qr_code,
        "qr_token": rsvp.qr_code,
        "qr_payload": f"MA5SOS:TICKET:{rsvp.qr_code}",
        "notes": rsvp.notes,
        "checked_in": bool(rsvp.checked_in),
        "checked_in_at": as_utc(rsvp.checked_in_at),
        "event_title": event.title,
        "event_date": as_utc(event.event_date),
        "event_time": event.event_time,
        "venue_name": event.venue_name,
        "host_name": event.host_name,
        "share_code": event.share_code,
        "max_guests": event.max_guests,
    }


@router.get("/invite/{share_code}", response_model=PublicInvitationOut)
def get_public_invitation(share_code: str, db: Session = Depends(get_db)):
    event = _find_event(db, share_code)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="عذرًا، لم يتم العثور على هذه الدعوة. يرجى التأكد من صحة الرابط.",
        )

    confirmed = sum(1 for r in event.rsvps if r.status == "confirmed")
    attending = _attending_count(event)
    return PublicInvitationOut(
        title=event.title,
        occasion_type=event.occasion_type,
        host_name=event.host_name,
        honoree_name=event.honoree_name,
        event_date=event.event_date,
        event_time=event.event_time,
        venue_name=event.venue_name,
        venue_address=event.venue_address,
        location_url=event.location_url,
        description=event.description,
        notes=event.notes,
        template_id=event.template_id or "andalusian",
        share_code=event.share_code,
        max_guests=event.max_guests,
        confirmed_count=confirmed,
        attending_count=attending,
    )


@router.get(
    "/invite/{share_code}/guest/{invite_token}",
    response_model=PrivateInvitationOut,
)
def get_private_invitation(
    share_code: str,
    invite_token: str,
    db: Session = Depends(get_db),
):
    """Return one guest's private invitation and current RSVP state."""
    event = _find_event(db, share_code)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="لم نجد هذه الدعوة. تأكد من الرابط الذي أرسله لك الداعي.",
        )

    guest = _find_guest_by_token(db, event, invite_token)
    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="رابط الدعوة غير صالح أو تم إلغاؤه. تواصل مع صاحب المناسبة للحصول على رابط جديد.",
        )

    confirmed = sum(1 for r in event.rsvps if r.status == "confirmed")
    return PrivateInvitationOut(
        title=event.title,
        occasion_type=event.occasion_type,
        host_name=event.host_name,
        honoree_name=event.honoree_name,
        event_date=event.event_date,
        event_time=event.event_time,
        venue_name=event.venue_name,
        venue_address=event.venue_address,
        location_url=event.location_url,
        description=event.description,
        notes=event.notes,
        template_id=event.template_id or "andalusian",
        share_code=event.share_code,
        max_guests=event.max_guests,
        confirmed_count=confirmed,
        attending_count=_attending_count(event),
        guest=_private_guest_payload(guest),
    )


@router.post(
    "/invite/{share_code}/guest/{invite_token}/respond",
    response_model=RSVPResponseOut,
)
def respond_private_invitation(
    share_code: str,
    invite_token: str,
    data: GuestRespondRequest,
    db: Session = Depends(get_db),
):
    """The guest confirms or declines from their own private link."""
    event = _find_event(db, share_code)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="لم نجد هذه الدعوة. تأكد من الرابط الذي أرسله لك الداعي.",
        )

    guest = _find_guest_by_token(db, event, invite_token)
    if not guest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="رابط الدعوة غير صالح أو تم إلغاؤه. تواصل مع صاحب المناسبة للحصول على رابط جديد.",
        )

    name = " ".join((data.guest_name or "").split())
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="يرجى كتابة اسمك الكريم (حرفان على الأقل).")

    if guest.checked_in and data.status == "declined":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تم تسجيل دخولك بالفعل، ولا يمكن تحويل الرد إلى اعتذار الآن.",
        )

    if data.status == "confirmed":
        new_seats = (guest.companions_count or 0) + 1
        projected = _reserved_count(event, exclude_id=guest.id) + new_seats
        if projected > int(event.max_guests or 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"اكتمل العدد المتاح لهذه المناسبة ({event.max_guests} مدعوين). "
                    "تواصل مع صاحب المناسبة."
                ),
            )
        if not guest.qr_code:
            candidate = generate_qr_code(event.share_code)
            while db.query(GuestRSVP).filter(GuestRSVP.qr_code == candidate).first():
                candidate = generate_qr_code(event.share_code)
            guest.qr_code = candidate
        guest.status = "confirmed"
    else:
        guest.status = "declined"

    guest.guest_name = name
    guest.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(guest)

    msg = (
        f"تم تأكيد حضورك بنجاح يا {guest.guest_name}! "
        "تذكرتك ورمز QR الخاص بك ظاهران أدناه، ويُرجى إبرازهما عند بوابة الدخول."
        if guest.status == "confirmed"
        else f"تم استلام اعتذارك يا {guest.guest_name}، نشكرك على إبلاغنا ونتمنى لك دوام الأفراح."
    )
    return RSVPResponseOut(
        ok=True,
        message=msg,
        rsvp=GuestRSVPOut.model_validate(guest),
        event_title=event.title,
        event_date=event.event_date,
        event_time=event.event_time,
        venue_name=event.venue_name,
        host_name=event.host_name,
    )


@router.post("/invite/{share_code}/rsvp", response_model=RSVPResponseOut)
def submit_rsvp(
    share_code: str,
    data: GuestRSVPCreate,
    db: Session = Depends(get_db),
):
    event = _find_event(db, share_code)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="عذرًا، لم يتم العثور على هذه الدعوة.",
        )

    guest_name = " ".join((data.guest_name or "").split())
    if len(guest_name) < 2:
        raise HTTPException(status_code=400, detail="يرجى كتابة اسم الضيف (حرفان على الأقل).")

    phone = normalize_saudi_mobile(data.phone)
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05.",
        )

    status_value = data.status if data.status in {"confirmed", "declined", "pending"} else "confirmed"
    companions = max(0, min(int(data.companions_count or 0), 10))
    notes = (data.notes or "").strip() or None

    existing = (
        db.query(GuestRSVP)
        .filter(
            GuestRSVP.event_id == event.id,
            GuestRSVP.phone.in_(phone_variants(phone)),
        )
        .first()
    )

    new_seats = companions + 1 if status_value != "declined" else 0
    projected = _reserved_count(event, exclude_id=existing.id if existing else None) + new_seats
    if status_value != "declined" and projected > event.max_guests:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"عذرًا، الحد الأقصى لهذه المناسبة {event.max_guests} مدعوين. المساحة المتبقية لا تكفي لعدد المرافقين المطلوب.",
        )

    if existing:
        existing.guest_name = guest_name
        existing.phone = phone
        existing.status = status_value
        existing.companions_count = companions
        existing.notes = notes
        if not existing.invite_token:
            existing.invite_token = _unique_invite_token(db)
        existing.updated_at = datetime.now(timezone.utc)
        rsvp = existing
    else:
        qr_code = generate_qr_code(event.share_code)
        while db.query(GuestRSVP).filter(GuestRSVP.qr_code == qr_code).first():
            qr_code = generate_qr_code(event.share_code)

        rsvp = GuestRSVP(
            event_id=event.id,
            guest_name=guest_name,
            phone=phone,
            status=status_value,
            companions_count=companions,
            qr_code=qr_code,
            invite_token=_unique_invite_token(db),
            notes=notes,
            checked_in=False,
        )
        db.add(rsvp)

    db.commit()
    db.refresh(rsvp)

    msg = (
        "تم تأكيد حضورك بنجاح! شكرًا لك، وبحضورك تكتمل فرحتنا. تذكرة الدخول ورمز QR الخاص بك ظاهران أدناه."
        if status_value == "confirmed"
        else "تم استلام اعتذارك، نشكرك على إبلاغنا ونتمنى لك دوام الأفراح."
    )
    return RSVPResponseOut(
        ok=True,
        message=msg,
        rsvp=GuestRSVPOut.model_validate(rsvp),
        event_title=event.title,
        event_date=event.event_date,
        event_time=event.event_time,
        venue_name=event.venue_name,
        host_name=event.host_name,
    )


@router.get("/invite/{share_code}/ticket/{qr_code}")
def get_invitation_ticket(share_code: str, qr_code: str, db: Session = Depends(get_db)):
    """Restores a guest's ticket on the same device (or after reopening the link)."""
    event = _find_event(db, share_code)
    if not event:
        raise HTTPException(status_code=404, detail="لم يتم العثور على هذه الدعوة.")
    rsvp = (
        db.query(GuestRSVP)
        .filter(
            GuestRSVP.event_id == event.id,
            func.upper(GuestRSVP.qr_code) == qr_code.strip().upper(),
        )
        .first()
    )
    if not rsvp:
        raise HTTPException(status_code=404, detail="لم يتم العثور على تذكرة هذا الضيف.")
    return {"ok": True, "rsvp": _guest_payload(rsvp, event), "event_title": event.title}


@router.get("/ticket/{qr_code}")
def verify_ticket(qr_code: str, db: Session = Depends(get_db)):
    code = (qr_code or "").strip()
    rsvp = (
        db.query(GuestRSVP)
        .filter(func.upper(GuestRSVP.qr_code) == code.upper())
        .first()
    )
    if not rsvp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="رمز الدخول أو بطاقة الدعوة غير صالحة.",
        )

    event = rsvp.event
    return {
        "valid": True,
        "guest_name": rsvp.guest_name,
        "phone": rsvp.phone,
        "status": rsvp.status,
        "companions_count": rsvp.companions_count,
        "companion_count": rsvp.companions_count,
        "checked_in": bool(rsvp.checked_in),
        "checked_in_at": as_utc(rsvp.checked_in_at),
        "notes": rsvp.notes,
        "event_title": event.title,
        "event_date": as_utc(event.event_date),
        "event_time": event.event_time,
        "venue_name": event.venue_name,
        "host_name": event.host_name,
        "share_code": event.share_code,
    }
