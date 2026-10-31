import secrets
from datetime import datetime, timezone
from html import escape
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from api.auth import get_current_admin
from api.config import settings
from api.database import get_db
from api.models import AdminUser, Order
from api.paylink import add_invoice, get_invoice, mark_mock_paid, mock_invoice, paylink_mode
from api.phone import local_saudi_mobile
from api.plans import ALL_PLANS
from api.schemas import OrderCreate, OrderOut

router = APIRouter(prefix="/orders", tags=["Orders & Payment"])
webhook_router = APIRouter(tags=["Paylink Webhook"])


def _public_order(order: Order) -> dict:
    return OrderOut(
        orderNumber=order.order_number,
        planId=order.plan_id,
        amount=order.amount,
        status=order.status,
        paymentMethod=order.payment_method,
        createdAt=order.created_at,
        paidAt=order.paid_at,
    ).model_dump()


def _mark_user_paid(db: Session, user: AdminUser, plan_id: str) -> None:
    if plan_id == "trial":
        return
    user.has_paid = True
    user.plan_id = plan_id
    db.add(user)


def _mark_order_paid(db: Session, order: Order, method: str | None = None) -> Order:
    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)
    if method:
        order.payment_method = method
    user = db.query(AdminUser).filter(AdminUser.id == order.user_id).first()
    if user:
        _mark_user_paid(db, user, order.plan_id)
    db.commit()
    db.refresh(order)
    return order


def _refresh_order(db: Session, order: Order) -> Order:
    if order.status != "pending" or not order.transaction_no:
        return order
    try:
        invoice = get_invoice(order.transaction_no)
    except Exception:
        return order
    status_text = str((invoice or {}).get("orderStatus") or "").strip().lower()
    amount = float((invoice or {}).get("amount") or 0)
    if status_text == "paid" and abs(amount - float(order.amount)) < 0.01:
        receipt = (invoice or {}).get("paymentReceipt") or {}
        return _mark_order_paid(db, order, receipt.get("paymentMethod"))
    if status_text in {"canceled", "cancelled", "failed"}:
        order.status = "canceled"
        db.commit()
        db.refresh(order)
    return order


def _base_url(request: Request) -> str:
    origin = (request.headers.get("origin") or "").strip().rstrip("/")
    if origin.startswith(("http://", "https://")):
        return origin
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip()
    if host:
        scheme = (request.headers.get("x-forwarded-proto") or request.url.scheme or "https").split(",")[0].strip()
        return f"{scheme}://{host}".rstrip("/")
    return settings.SITE_URL.rstrip("/")


def _payment_error_detail(error: Exception) -> str:
    text = str(error)
    if "order-monthly-limit-exceeded" in text or "38598" in text:
        return (
            "حساب Paylink غير مفعّل للدفع الحقيقي بعد: الحد الشهري المسموح به "
            "0 ريال. تواصل مع Paylink لرفع الحد وتفعيل الحساب."
        )
    if "order-minimum-amount" in text or "22236" in text:
        return "الحد الأدنى للفاتورة في Paylink هو 5 ريال."
    if "401" in text or "unauthorized" in text.lower():
        return "بيانات Paylink غير صحيحة أو منتهية. راجع إعدادات بوابة الدفع."
    return (
        "تعذّر فتح صفحة الدفع حاليًا. تأكد من إعدادات بوابة الدفع "
        "أو أعد المحاولة بعد قليل."
    )


@router.get("")
def list_orders(admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = db.query(Order).filter(Order.user_id == admin.id).order_by(Order.id.desc()).all()
    return {"orders": [_public_order(row) for row in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_order(
    data: OrderCreate,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    plan = ALL_PLANS.get(str(data.planId or "").strip())
    if not plan:
        raise HTTPException(status_code=400, detail="الباقة المختارة غير صحيحة.")

    order_number = f"MK{secrets.token_hex(5).upper()}"

    if plan["price"] == 0:
        if getattr(admin, "has_paid", False):
            raise HTTPException(
                status_code=409,
                detail="لديك باقة مفعّلة بالفعل، ولا تحتاج إلى التجربة المجانية.",
            )
        used = db.query(Order).filter(Order.user_id == admin.id, Order.plan_id == plan["id"]).first()
        if used:
            raise HTTPException(
                status_code=409,
                detail="استخدمت التجربة المجانية مسبقًا. اختر إحدى الباقات المدفوعة للمتابعة.",
            )
        order = Order(
            order_number=order_number,
            user_id=admin.id,
            plan_id=plan["id"],
            amount=0,
            status="paid",
            payment_method="trial",
            paid_at=datetime.now(timezone.utc),
        )
        db.add(order)
        db.commit()
        return {"orderNumber": order_number, "status": "paid", "trial": True}

    order = Order(
        order_number=order_number,
        user_id=admin.id,
        plan_id=plan["id"],
        amount=plan["price"],
        status="pending",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    base = _base_url(request)
    return_url = f"{base}/payment/"
    try:
        invoice = add_invoice(
            order_number=order_number,
            amount=plan["price"],
            client_name=admin.name,
            client_mobile=local_saudi_mobile(admin.phone) if admin.phone else "0500000000",
            product={"title": plan["name"], "description": plan["tagline"]},
            call_back_url=return_url,
            cancel_url=f"{return_url}?OrderNumber={order_number}&cancelled=1",
        )
    except Exception as error:
        order.status = "canceled"
        db.commit()
        print(f"[Ma5sos Paylink] {error}")
        raise HTTPException(
            status_code=502,
            detail=_payment_error_detail(error),
        )

    if not invoice or not invoice.get("url") or not invoice.get("transactionNo"):
        order.status = "canceled"
        db.commit()
        raise HTTPException(
            status_code=502,
            detail="تعذّر فتح صفحة الدفع حاليًا. تأكد من إعدادات بوابة الدفع أو أعد المحاولة بعد قليل.",
        )

    order.transaction_no = str(invoice["transactionNo"])
    order.payment_url = str(invoice["url"])
    db.commit()
    return {
        "orderNumber": order_number,
        "status": "pending",
        "paymentUrl": invoice["url"],
        "transactionNo": order.transaction_no,
    }


@router.get("/{order_number}")
def get_order(
    order_number: str,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    order = (
        db.query(Order)
        .filter(Order.order_number == order_number, Order.user_id == admin.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="لم يتم العثور على هذا الطلب.")
    try:
        order = _refresh_order(db, order)
        return {"order": _public_order(order)}
    except Exception:
        return {"order": _public_order(order), "checkFailed": True}


@webhook_router.get("/paylink/webhook")
@webhook_router.get("/api/paylink/webhook")
def paylink_webhook_probe():
    """Plain JSON for Paylink's portal "Test" button and manual checks."""
    return {
        "ok": True,
        "status": "success",
        "service": "ma5sos-paylink-webhook",
    }


@webhook_router.post("/paylink/webhook")
@webhook_router.post("/api/paylink/webhook")
async def paylink_webhook(request: Request, db: Session = Depends(get_db)):
    expected = settings.PAYLINK_WEBHOOK_TOKEN
    if expected:
        authorization = request.headers.get("authorization") or ""
        if authorization != f"Bearer {expected}":
            raise HTTPException(status_code=401, detail="unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    order_number = str(body.get("merchantOrderNumber") or body.get("orderNumber") or "")
    order = db.query(Order).filter(Order.order_number == order_number).first() if order_number else None
    if order:
        try:
            _refresh_order(db, order)
        except Exception:
            raise HTTPException(status_code=503, detail="retry")
    return {
        "ok": True,
        "status": "success",
        "message": "webhook received",
    }


@webhook_router.get("/mock-paylink/{transaction_no}", response_class=HTMLResponse)
@webhook_router.get("/api/mock-paylink/{transaction_no}", response_class=HTMLResponse)
def mock_paylink_page(
    transaction_no: str,
    request: Request,
    action: str | None = None,
    db: Session = Depends(get_db),
):
    if paylink_mode() != "mock":
        raise HTTPException(status_code=404, detail="Not found")

    order = db.query(Order).filter(Order.transaction_no == transaction_no).first()
    invoice = mock_invoice(transaction_no)
    if not order and not invoice:
        raise HTTPException(status_code=404, detail="فاتورة المحاكاة غير موجودة.")

    order_number = order.order_number if order else invoice["orderNumber"]
    amount = order.amount if order else invoice["amount"]
    plan = ALL_PLANS.get(order.plan_id if order else "", {})
    title = plan.get("name") or (invoice or {}).get("product", {}).get("title") or "باقة مخصوص"

    if action in {"pay", "cancel"}:
        if action == "pay":
            mark_mock_paid(transaction_no)
            if order:
                _mark_order_paid(db, order, "mock")
        else:
            if order and order.status == "pending":
                order.status = "canceled"
                db.commit()
        query = {"OrderNumber": order_number, "TransactionNo": transaction_no}
        if action == "cancel":
            query["cancelled"] = "1"
        target = f"/payment/?{urlencode(query)}"
        return RedirectResponse(target, status_code=303)

    title_html = escape(str(title))
    order_html = escape(str(order_number))
    amount_html = escape(str(amount))
    return f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>محاكاة الدفع — مخصوص</title>
<style>
  body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f4ee; font-family: Tahoma, sans-serif; color: #2e3a35; }}
  main {{ width: min(92vw, 420px); padding: 28px; border-radius: 16px; background: #fff; box-shadow: 0 10px 30px rgba(15,61,50,.08); }}
  .tag {{ display: inline-block; padding: 2px 10px; border-radius: 99px; background: #fff3cd; color: #7a5a00; font-size: 13px; }}
  h1 {{ margin: 12px 0 4px; font-size: 22px; }}
  .amount {{ margin: 16px 0; font-size: 34px; font-weight: 700; color: #0f3d32; }}
  a {{ display: block; margin-top: 10px; padding: 12px; border-radius: 10px; text-align: center; text-decoration: none; font-weight: 700; }}
  .pay {{ background: #0f3d32; color: #f7f4ee; }} .cancel {{ background: #eee; color: #333; }}
  p {{ color: #6b7468; font-size: 14px; }}
</style></head><body><main>
  <span class="tag">محاكاة محلية — لا تُدفع أي أموال</span>
  <h1>{title_html}</h1>
  <div>طلب {order_html}</div>
  <div class="amount">{amount_html} ريال</div>
  <a class="pay" href="?action=pay">ادفع (محاكاة)</a>
  <a class="cancel" href="?action=cancel">إلغاء الدفع</a>
  <p>هذه الصفحة تظهر فقط عند PAYLINK_ENV=mock أثناء التطوير.</p>
</main></body></html>"""
