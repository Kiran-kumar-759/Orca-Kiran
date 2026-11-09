from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["Health"])
async def check_health():
    """System health check and provider readiness report."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "providers": {
            "groq": "configured" if bool(settings.GROQ_API_KEY) else "unconfigured",
            "gemini": "configured" if bool(settings.GEMINI_API_KEY) else "unconfigured",
            "openrouter": "configured"
            if bool(settings.OPENROUTER_API_KEY)
            else "unconfigured",
        },
        "database": "postgresql+psycopg",
        "timestamp": datetime.now(UTC).isoformat(),
    }
