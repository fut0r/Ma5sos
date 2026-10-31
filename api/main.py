from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.config import settings
from api.database import ensure_db_initialized
from api.paylink import paylink_mode
from api.routers import auth, events, orders, public, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_db_initialized()
    yield


app = FastAPI(
    title="Ma5sos API",
    description="منصة مخصوص للدعوات الإلكترونية الذكية وإدارة الحضور",
    version="1.2.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS setup
origins = list(
    dict.fromkeys(
        [
            settings.SITE_URL.rstrip("/"),
            settings.SITE_URL.replace("://www.", "://").rstrip("/"),
            settings.SITE_URL.replace("://", "://www.").rstrip("/"),
            "https://ma5sos.com",
            "https://www.ma5sos.com",
            "https://mazom.net",
            "https://www.mazom.net",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://localhost:8000",
        ]
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if settings.ENVIRONMENT == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """One readable Arabic sentence instead of FastAPI's English field list."""
    errors = exc.errors()
    field = ""
    if errors:
        location = [part for part in errors[0].get("loc", ()) if part not in {"body", "query", "path"}]
        field = str(location[-1]) if location else ""
    messages = {
        "password": "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
        "phone": "يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05.",
        "name": "يرجى كتابة الاسم (حرفان على الأقل).",
        "email": "يرجى إدخال بريد إلكتروني صحيح.",
        "guest_name": "يرجى كتابة اسم الضيف.",
        "event_date": "يرجى تحديد تاريخ المناسبة بشكل صحيح.",
        "max_guests": "عدد المدعوين غير صالح.",
    }
    detail = messages.get(field) or "بعض البيانات المدخلة غير مكتملة أو غير صحيحة. يرجى مراجعتها والمحاولة ثانية."
    return JSONResponse(status_code=400, content={"detail": detail})


@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    database = "PostgreSQL" if "postgresql" in settings.DATABASE_URL else "SQLite"
    return {
        "status": "ok",
        "service": "Ma5sos API",
        "version": app.version,
        "database": database,
        "payments": paylink_mode(),
    }


for prefix in ["/api", ""]:
    app.include_router(auth.router, prefix=prefix)
    app.include_router(events.router, prefix=prefix)
    app.include_router(public.router, prefix=prefix)
    app.include_router(stats.router, prefix=prefix)
    app.include_router(orders.router, prefix=prefix)

app.include_router(orders.webhook_router)

DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
if hasattr(app, "frontend"):
    app.frontend("/", directory=str(DIST_DIR), check_dir=False)
elif DIST_DIR.exists():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")
