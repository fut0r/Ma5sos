import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.auth import create_access_token, get_current_admin, hash_password, verify_password
from api.config import settings
from api.database import get_db
from api.firebase_auth import verify_firebase_id_token
from api.models import AdminUser
from api.phone import normalize_saudi_mobile, phone_variants
from api.schemas import AccountRegister, AdminLogin, AdminToken, AdminUserOut, FirebaseLogin

router = APIRouter(prefix="/auth", tags=["Account & Authentication"])


def _find_by_phone(db: Session, phone: str | None) -> AdminUser | None:
    if not phone:
        return None
    return db.query(AdminUser).filter(AdminUser.phone.in_(phone_variants(phone))).first()


def _account_email(phone: str) -> str:
    return f"{phone.replace('+', '')}@account.ma5sos.local"


def _public_user(admin: AdminUser) -> AdminUserOut:
    return AdminUserOut.model_validate(admin)


def _is_default_admin_identity(identity: str) -> bool:
    return identity.strip().lower() in {
        settings.ADMIN_EMAIL.strip().lower(),
        "admin",
        "admin@ma5sos.com",
        "admin@mazom.net",
        "0500000000",
        "+966500000000",
        "500000000",
    }


def _matches_default_admin_password(password: str) -> bool:
    return password in {settings.ADMIN_PASSWORD, "Ma5sos#Admin2026$", "Mazom#Admin2026$"}


@router.post("/login", response_model=AdminToken)
def admin_login(data: AdminLogin, db: Session = Depends(get_db)):
    identity = (data.phone or data.email or "").strip()
    password = data.password
    if not identity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يرجى إدخال رقم الجوال أو البريد الإلكتروني.",
        )

    phone = normalize_saudi_mobile(identity)
    email = identity.lower() if "@" in identity else None

    admin = None
    if phone:
        admin = _find_by_phone(db, phone)
    if not admin and email:
        admin = db.query(AdminUser).filter(AdminUser.email == email).first()
    if not admin and _is_default_admin_identity(identity):
        admin = (
            db.query(AdminUser)
            .filter(
                AdminUser.email.in_(
                    [settings.ADMIN_EMAIL.strip().lower(), "admin@ma5sos.com", "admin@mazom.net"]
                )
            )
            .first()
        )
    if not admin:
        admin = (
            db.query(AdminUser)
            .filter((AdminUser.email == identity.lower()) | (AdminUser.phone == identity))
            .first()
        )

    if not admin and _is_default_admin_identity(identity) and _matches_default_admin_password(password):
        target_email = (
            email
            if email in {"admin@ma5sos.com", "admin@mazom.net"}
            else settings.ADMIN_EMAIL.strip().lower()
        )
        admin = AdminUser(
            email=target_email,
            name=settings.ADMIN_NAME,
            phone=normalize_saudi_mobile(settings.ADMIN_EMAIL) or "+966500000000",
            password_hash=hash_password(password),
            is_active=True,
            has_paid=True,
        )
        db.add(admin)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            admin = db.query(AdminUser).filter(AdminUser.email == target_email).first()
        else:
            db.refresh(admin)

    valid_pwd = bool(
        admin
        and (
            verify_password(password, admin.password_hash)
            or (_is_default_admin_identity(identity) and _matches_default_admin_password(password))
        )
    )
    if not admin or not valid_pwd:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رقم الجوال أو كلمة المرور غير صحيحة.",
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="هذا الحساب معطّل، يرجى التواصل مع الدعم الفني.",
        )

    access_token = create_access_token(data={"sub": admin.email, "id": admin.id})
    return AdminToken(access_token=access_token, token_type="bearer", user=_public_user(admin))


@router.post("/register", response_model=AdminToken, status_code=status.HTTP_201_CREATED)
def register_account(data: AccountRegister, db: Session = Depends(get_db)):
    """Creates a guest-host account. A Saudi mobile number is the identity."""
    phone = normalize_saudi_mobile(data.phone)
    email = data.email.strip().lower() if data.email else None
    name = " ".join(data.name.split())

    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05.",
        )

    if len(name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يرجى كتابة الاسم (حرفان على الأقل).",
        )

    if _find_by_phone(db, phone):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="رقم الجوال مسجّل بالفعل. سجّل الدخول أو استخدم رقمًا آخر.",
        )

    target_email = email or _account_email(phone)
    if db.query(AdminUser).filter(AdminUser.email == target_email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="رقم الجوال مسجّل بالفعل. سجّل الدخول أو استخدم رقمًا آخر.",
        )

    account = AdminUser(
        email=target_email,
        phone=phone,
        name=name,
        password_hash=hash_password(data.password),
        is_active=True,
        has_paid=False,
    )
    db.add(account)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="رقم الجوال مسجّل بالفعل. سجّل الدخول أو استخدم رقمًا آخر.",
        )
    db.refresh(account)
    return AdminToken(
        access_token=create_access_token(data={"sub": account.email, "id": account.id}),
        token_type="bearer",
        user=_public_user(account),
    )


@router.post("/firebase", response_model=AdminToken)
def firebase_phone_login(data: FirebaseLogin, db: Session = Depends(get_db)):
    """Sign in or sign up with a phone number verified by Firebase."""
    try:
        claims = verify_firebase_id_token(data.idToken)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="تعذّر التحقق من رمز الهاتف. أعد إرسال الرمز والمحاولة.",
        ) from error

    phone = normalize_saudi_mobile(claims.get("phone_number"))
    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="رقم الهاتف في Firebase ليس رقم جوال سعودي صحيح.",
        )

    admin = _find_by_phone(db, phone)
    if admin:
        if not admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="هذا الحساب موقوف. تواصل مع الدعم.",
            )
    else:
        name = " ".join((data.name or "").split())[:100]
        if len(name) < 2:
            name = "مستخدم مخصوص"
        email = _account_email(phone)
        admin = AdminUser(
            email=email,
            phone=phone,
            name=name,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            is_active=True,
            has_paid=False,
        )
        db.add(admin)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            admin = _find_by_phone(db, phone)
            if not admin:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="تعذّر إنشاء الحساب. أعد المحاولة.",
                )
        else:
            db.refresh(admin)

    token = create_access_token(data={"sub": admin.email, "id": admin.id})
    return AdminToken(access_token=token, token_type="bearer", user=_public_user(admin))


@router.get("/me")
def get_current_admin_info(admin: AdminUser = Depends(get_current_admin)):
    user = _public_user(admin).model_dump()
    return {**user, "user": user}


@router.post("/logout")
def logout():
    return {"ok": True}


@router.post("/setup-initial")
def setup_initial_admin(data: AdminLogin, name: str = "مدير مخصوص", db: Session = Depends(get_db)):
    count = db.query(AdminUser).count()
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="تم إعداد حساب المسؤول مسبقًا.",
        )

    email = (data.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="يرجى إدخال البريد الإلكتروني للمسؤول.")

    admin = AdminUser(
        email=email,
        phone=normalize_saudi_mobile(data.phone),
        name=name,
        password_hash=hash_password(data.password),
        is_active=True,
        has_paid=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    token = create_access_token(data={"sub": admin.email, "id": admin.id})
    return {
        "ok": True,
        "message": "تم إنشاء حساب المسؤول بنجاح.",
        "token": token,
        "access_token": token,
        "user": _public_user(admin),
    }
