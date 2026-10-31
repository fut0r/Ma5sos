import os

try:
    from dotenv import load_dotenv

    load_dotenv(".env.local")
    load_dotenv(".env")
except Exception:
    pass


def _detect_environment() -> str:
    explicit = os.getenv("NODE_ENV") or os.getenv("ENV")
    if explicit:
        return explicit.strip().lower()
    return "production" if os.getenv("VERCEL") else "development"


def _detect_site_url(environment: str) -> str:
    explicit = (os.getenv("SITE_URL") or "").strip()
    if explicit:
        return explicit.rstrip("/")
    vercel_host = (os.getenv("VERCEL_PROJECT_PRODUCTION_URL") or os.getenv("VERCEL_URL") or "").strip()
    if vercel_host:
        return f"https://{vercel_host}".rstrip("/")
    return "http://localhost:5173" if environment != "production" else "https://www.ma5sos.com"


ENVIRONMENT = _detect_environment()

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./server/data/ma5sos.db")
        DATABASE_URL_UNPOOLED: str = os.getenv("DATABASE_URL_UNPOOLED", "")
        JWT_SECRET: str = os.getenv("JWT_SECRET", "ma5sos-secret-jwt-key-2026-saudi-digital-invites")
        JWT_ALGORITHM: str = "HS256"
        ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
        SITE_URL: str = _detect_site_url(ENVIRONMENT)
        ENVIRONMENT: str = ENVIRONMENT
        ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@ma5sos.com")
        ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Ma5sos#Admin2026$")
        ADMIN_NAME: str = os.getenv("ADMIN_NAME", "مدير مخصوص")

        PAYLINK_ENV: str = os.getenv("PAYLINK_ENV", "")
        PAYLINK_API_ID: str = os.getenv("PAYLINK_API_ID", "")
        PAYLINK_SECRET_KEY: str = os.getenv("PAYLINK_SECRET_KEY", "")
        PAYLINK_WEBHOOK_TOKEN: str = os.getenv("PAYLINK_WEBHOOK_TOKEN", "")

        FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "mazom-8ce99")

        model_config = SettingsConfigDict(extra="ignore")

except ImportError:
    class Settings:  # type: ignore[no-redef]
        def __init__(self) -> None:
            self.DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./server/data/ma5sos.db")
            self.DATABASE_URL_UNPOOLED: str = os.getenv("DATABASE_URL_UNPOOLED", "")
            self.JWT_SECRET: str = os.getenv("JWT_SECRET", "ma5sos-secret-jwt-key-2026-saudi-digital-invites")
            self.JWT_ALGORITHM: str = "HS256"
            self.ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
            self.SITE_URL: str = _detect_site_url(ENVIRONMENT)
            self.ENVIRONMENT: str = ENVIRONMENT
            self.ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@ma5sos.com")
            self.ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Ma5sos#Admin2026$")
            self.ADMIN_NAME: str = os.getenv("ADMIN_NAME", "مدير مخصوص")
            self.PAYLINK_ENV: str = os.getenv("PAYLINK_ENV", "")
            self.PAYLINK_API_ID: str = os.getenv("PAYLINK_API_ID", "")
            self.PAYLINK_SECRET_KEY: str = os.getenv("PAYLINK_SECRET_KEY", "")
            self.PAYLINK_WEBHOOK_TOKEN: str = os.getenv("PAYLINK_WEBHOOK_TOKEN", "")
            self.FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "mazom-8ce99")


settings = Settings()
