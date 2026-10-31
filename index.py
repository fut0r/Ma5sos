"""Vercel FastAPI entrypoint.

The application itself lives in ``api/main.py``. Keeping a root entrypoint lets
Vercel detect the Python framework without mistaking the Vite frontend for the
project owner.
"""

from api.main import app

__all__ = ["app"]
