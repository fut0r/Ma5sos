import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.auth import get_current_admin
from api.config import settings
from api.dates import as_utc
from api.database import get_db
from api.models import AdminUser, Event, GuestRSVP
from api.phone import normalize_saudi_mobile, phone_variants
from api.plans import ALL_PLANS, TRIAL
from api.qr import read_qr
from api.schemas import (
    CheckInRequest,
    EventCreate,
    EventOut,
    EventUpdate,
    GuestInviteCreate,
    GuestInviteUpdate,
    GuestRSVPOut,
)
from api.tokens import generate_invite_token, generate_qr_code

router = APIRouter(prefix="/events", tags=["Events Management"])


def generate_share_code() -> str:
    """Generates a clean, readable and secure share code e.g. MK-8K2Q-9F3P."""
    return f"MK-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"


def _is_super_admin(admin: AdminUser) -> bool:
    return admin.email.strip().lower() in {
        settings.ADMIN_EMAIL.strip().lower(),
        "admin@ma5sos.com",
        "admin@mazom.net",
    }


def _scoped(query, admin: AdminUser):
    if _is_super_admin(admin):
        return query.filter((Event.user_id == admin.id) | (Event.user_id.is_(None)))
    return query.filter(Event.user_id == admin.id)


def _find_scoped_event(db: Session, event_id: int, admin: AdminUser) -> Event | None:
    return _scoped(db.query(Event), admin).filter(Event.id == event_id).first()


def attach_event_stats(event: Event) -> EventOut:
    confirmed = sum(1 for r in event.rsvps if r.status == "confirmed")
    declined = sum(1 for r in event.rsvps if r.status == "declined")
    total_guests = sum((r.companions_count or 0) + 1 for r in event.rsvps if r.status == "confirmed")
    event_out = EventOut.model_validate(event)
    event_out.total_rsvps = len(event.rsvps)
    event_out.confirmed_count = confirmed
    event_out.declined_count = declined
    event_out.total_guests = total_guests
    return event_out


def _plan_for(admin: AdminUser) -> dict:
    plan_id = getattr(admin, "plan_id", None)
    if getattr(admin, "has_paid", False):
        return ALL_PLANS.get(plan_id) or ALL_PLANS["plus"]
    return TRIAL


def _guest_seats(guest: GuestRSVP) -> int:
    return (guest.companions_count or 0) + 1


def _reserved_seats(event: Event, exclude_id: int | None = None) -> int:
    """Pending and confirmed guests hold a seat; decliners do not."""
    return sum(
        _guest_seats(guest)
        for guest in event.rsvps
        if guest.status != "declined" and guest.id != exclude_id
    )


def _ensure_capacity(event: Event, seats: int, exclude_id: int | None = None) -> None:
    total = _reserved_seats(event, exclude_id) + max(1, seats)
    if total > int(event.max_guests or 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"لا يمكن إضافة المدعو: العدد الإجمالي سيصبح {total}، "
                f"والحد الأقصى للمناسبة {event.max_guests}. ارفع الحد الأقصى أو احذف مدعوًا آخر."
            ),
        )


def _unique_qr_code(db: Session, share_code: str) -> str:
    code = generate_qr_code(share_code)
    while db.query(GuestRSVP).filter(GuestRSVP.qr_code == code).first():
        code = generate_qr_code(share_code)
    return code


def _unique_invite_token(db: Session) -> str:
    token = generate_invite_token()
    while db.query(GuestRSVP).filter(GuestRSVP.invite_token == token).first():
        token = generate_invite_token()
    return token


def _find_guest(db: Session, event_id: int, guest_id: int) -> GuestRSVP | None:
    return (
        db.query(GuestRSVP)
        .filter(GuestRSVP.id == guest_id, GuestRSVP.event_id == event_id)
        .first()
    )


def _duplicate_phone(
    db: Session,
    event_id: int,
    phone: str,
    exclude_id: int | None = None,
) -> GuestRSVP | None:
    query = db.query(GuestRSVP).filter(
        GuestRSVP.event_id == event_id,
        GuestRSVP.phone.in_(phone_variants(phone)),
    )
    if exclude_id is not None:
        query = query.filter(GuestRSVP.id != exclude_id)
    return query.first()


@router.get("", response_model=List[EventOut])
def list_events(
    skip: int = 0,
    limit: int = 100,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    events = (
        _scoped(db.query(Event), admin)
        .order_by(Event.event_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [attach_event_stats(ev) for ev in events]


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    data: EventCreate,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    is_trial = not getattr(admin, "has_paid", False) and not _is_super_admin(admin)
    user_event_count = db.query(Event).filter(Event.user_id == admin.id).count()
    if is_trial and user_event_count >= 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="تتيح لك التجربة المجانية إنشاء مناسبة واحدة فقط. يُرجى الترقية إلى إحدى باقات مخصوص لإضافة المزيد من المناسبات.",
        )

    share_code = generate_share_code()
    while db.query(Event).filter(Event.share_code == share_code).first():
        share_code = generate_share_code()

    plan = _plan_for(admin)
    limit_guests = 5000 if _is_super_admin(admin) else int(plan.get("max_guests") or 3)
    final_max_guests = max(1, min(int(data.max_guests or limit_guests), limit_guests))

    new_event = Event(
        user_id=admin.id,
        title=data.title.strip(),
        occasion_type=data.occasion_type,
        host_name=data.host_name.strip(),
        honoree_name=data.honoree_name.strip() if data.honoree_name else None,
        event_date=data.event_date,
        event_time=data.event_time.strip() if data.event_time else None,
        venue_name=data.venue_name.strip(),
        venue_address=data.venue_address.strip() if data.venue_address else None,
        location_url=data.location_url.strip() if data.location_url else None,
        description=data.description.strip() if data.description else None,
        notes=data.notes.strip() if data.notes else None,
        template_id=data.template_id or "andalusian",
        share_code=share_code,
        is_public=data.is_public,
        max_guests=final_max_guests,
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return attach_event_stats(new_event)


@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    event = _find_scoped_event(db, event_id, admin)
    if not event:
        raise HTTPException(status_code=404, detail="المناسبة المطلوبة غير موجودة.")
    return attach_event_stats(event)


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    data: EventUpdate,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    event = _find_scoped_event(db, event_id, admin)
    if not event:
        raise HTTPException(status_code=404, detail="المناسبة المطلوبة غير موجودة.")

    update_dict = data.model_dump(exclude_unset=True)
    plan = _plan_for(admin)
    limit_guests = 5000 if _is_super_admin(admin) else int(plan.get("max_guests") or 3)
    if "max_guests" in update_dict and update_dict["max_guests"] is not None:
        update_dict["max_guests"] = max(1, min(int(update_dict["max_guests"]), limit_guests))

    for field, value in update_dict.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return attach_event_stats(event)


@router.delete("/{event_id}")
def delete_event(
    event_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    event = _find_scoped_event(db, event_id, admin)
    if not event:
        raise HTTPException(status_code=404, detail="المناسبة المطلوبة غير موجودة.")
    db.delete(event)
    db.commit()
    return {"ok": True, "message": "تم حذف المناسبة بنجاح."}


@router.post("/{event_id}/guests", response_model=GuestRSVPOut, status_code=status.HTTP_201_CREATED)
def create_guest(
    event_id: int,
    data: GuestInviteCreate,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """The host pre-adds a guest and gets a private link for that person."""
    event = _find_scoped_event(db, event_id, admin)
    if not event:
        raise HTTPException(status_code=404, detail="المناسبة غير موجودة أو لا تملك صلاحية الوصول إليها.")

    name = " ".join((data.guest_name or "").split())
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="يرجى كتابة اسم المدعو (حرفان على الأقل).")

    phone = normalize_saudi_mobile(data.phone)
    if not phone:
        raise HTTPException(status_code=400, detail="يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05.")

    existing = _duplicate_phone(db, event.id, phone)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"هذا الرقم مسجل بالفعل للمدعو {existing.guest_name}.",
        )

    companions = max(0, min(int(data.companions_count or 0), 10))
    _ensure_capacity(event, companions + 1)

    guest = GuestRSVP(
        event_id=event.id,
        guest_name=name,
        phone=phone,
        status="pending",
        companions_count=companions,
        qr_code=_unique_qr_code(db, event.share_code),
        invite_token=_unique_invite_token(db),
        notes=(data.notes or "").strip() or None,
        checked_in=False,
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return GuestRSVPOut.model_validate(guest)


@router.put("/{event_id}/guests/{guest_id}", response_model=GuestRSVPOut)
def update_guest(
    event_id: int,
    guest_id: int,
    data: GuestInviteUpdate,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    event = _find_scoped_event(db, event_id, admin)
    if not event:
        raise HTTPException(status_code=404, detail="المناسبة غير موجودة أو لا تملك صلاحية الوصول إليها.")

    guest = _find_guest(db, event.id, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="المدعو غير موجود في هذه المناسبة.")

    if data.guest_name is not None:
        name = " ".join(data.guest_name.split())
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="يرجى كتابة اسم المدعو (حرفان على الأقل).")
        guest.guest_name = name

    if data.phone is not None:
        phone = normalize_saudi_mobile(data.phone)
        if not phone:
            raise HTTPException(status_code=400, detail="يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05.")
        duplicate = _duplicate_phone(db, event.id, phone, exclude_id=guest.id)
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"هذا الرقم مسجل بالفعل للمدعو {duplicate.guest_name}.",
            )
        guest.phone = phone

    if data.companions_count is not None:
        companions = max(0, min(int(data.companions_count), 10))
        if guest.status != "declined":
            _ensure_capacity(event, companions + 1, exclude_id=guest.id)
        guest.companions_count = companions

    if "notes" in data.model_fields_set:
        guest.notes = (data.notes or "").strip() or None

    if not guest.qr_code:
        guest.qr_code = _unique_qr_code(db, event.share_code)
    if not guest.invite_token:
        guest.invite_token = _unique_invite_token(db)

    guest.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(guest)
    return GuestRSVPOut.model_validate(guest)


@router.post("/{event_id}/checkin")
def check_in_by_qr(
    event_id: int,
    data: Optional[CheckInRequest] = None,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    target_event = _find_scoped_event(db, event_id, admin)
    if not target_event:
        raise HTTPException(status_code=404, detail="المناسبة المطلوبة غير موجودة.")

    raw_input = ((data.qr_token or data.qr_code) if data else "") or ""
    rsvp_id = data.rsvp_id or data.guest_id if data else None
    reading = read_qr(raw_input)

    rsvp: GuestRSVP | None = None
    if reading.kind in {"empty", "foreign", "invalid"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reading.message)

    if reading.kind in {"ma5sos", "mazom"} and reading.token:
        rsvp = (
            db.query(GuestRSVP)
            .filter(
                GuestRSVP.event_id == event_id,
                func.upper(GuestRSVP.qr_code) == reading.token,
            )
            .first()
        )
        if not rsvp:
            other_rsvp = (
                db.query(GuestRSVP)
                .filter(func.upper(GuestRSVP.qr_code) == reading.token)
                .first()
            )
            if other_rsvp:
                other_title = other_rsvp.event.title if other_rsvp.event else "مناسبة أخرى"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"هذا الرمز صادر من مخصوص لكنه مسجّل لمناسبة أخرى ({other_title}) وليس لهذه المناسبة.",
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="رمز مخصوص غير مسجل. تأكد من أن الضيف أكّد حضوره وأن الرمز يعود لهذه المناسبة.",
            )
    elif rsvp_id:
        rsvp = (
            db.query(GuestRSVP)
            .filter(GuestRSVP.id == int(rsvp_id), GuestRSVP.event_id == event_id)
            .first()
        )

    if not rsvp:
        raise HTTPException(status_code=404, detail="لم يتم العثور على الضيف في قائمة هذه المناسبة.")

    if rsvp.status == "declined":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"الضيف {rsvp.guest_name} أرسل اعتذارًا عن الحضور، ولا يمكن تسجيل دخوله.",
        )

    if rsvp.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"حضور الضيف {rsvp.guest_name} غير مؤكد بعد. يرجى تأكيد رده أولًا.",
        )

    payload = {
        "ok": True,
        "already_checked_in": bool(rsvp.checked_in),
        "guest_id": rsvp.id,
        "guest_name": rsvp.guest_name,
        "phone": rsvp.phone,
        "companions_count": rsvp.companions_count or 0,
        "companion_count": rsvp.companions_count or 0,
        "status": rsvp.status,
        "notes": rsvp.notes,
        "checked_in": True,
        "checked_in_at": rsvp.checked_in_at,
        "event_title": target_event.title,
        "event_date": as_utc(target_event.event_date),
        "event_time": target_event.event_time,
        "venue_name": target_event.venue_name,
    }

    if rsvp.checked_in:
        payload["message"] = f"تنبيه: تم تسجيل دخول الضيف ({rsvp.guest_name}) مسبقًا."
        return payload

    rsvp.checked_in = True
    rsvp.checked_in_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rsvp)
    payload["checked_in_at"] = rsvp.checked_in_at
    payload["message"] = (
        f"تم تأكيد دخول {rsvp.guest_name} بنجاح"
        + (f" مع {rsvp.companions_count} مرافقين." if rsvp.companions_count else ".")
    )
    return payload


@router.post("/{event_id}/rsvps/{rsvp_id}/checkin")
def check_in_guest(
    event_id: int,
    rsvp_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not _find_scoped_event(db, event_id, admin):
        raise HTTPException(status_code=404, detail="المناسبة المطلوبة غير موجودة.")
    rsvp = (
        db.query(GuestRSVP)
        .filter(GuestRSVP.id == rsvp_id, GuestRSVP.event_id == event_id)
        .first()
    )
    if not rsvp:
        raise HTTPException(status_code=404, detail="سجل الضيف غير موجود.")
    rsvp.checked_in = not bool(rsvp.checked_in)
    rsvp.checked_in_at = datetime.now(timezone.utc) if rsvp.checked_in else None
    db.commit()
    db.refresh(rsvp)
    return {
        "ok": True,
        "checked_in": bool(rsvp.checked_in),
        "checked_in_at": as_utc(rsvp.checked_in_at),
        "guest_name": rsvp.guest_name,
    }


@router.delete("/{event_id}/rsvps/{rsvp_id}")
def delete_rsvp(
    event_id: int,
    rsvp_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not _find_scoped_event(db, event_id, admin):
        raise HTTPException(status_code=404, detail="المناسبة المطلوبة غير موجودة.")
    rsvp = (
        db.query(GuestRSVP)
        .filter(GuestRSVP.id == rsvp_id, GuestRSVP.event_id == event_id)
        .first()
    )
    if not rsvp:
        raise HTTPException(status_code=404, detail="سجل الضيف غير موجود.")
    db.delete(rsvp)
    db.commit()
    return {"ok": True, "message": "تم حذف الرد بنجاح."}
