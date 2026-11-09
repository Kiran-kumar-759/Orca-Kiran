from fastapi import APIRouter

from app.api.v1.endpoints import (
    forecasts,
    hazards,
    health,
    investigations,
    marine,
    reports,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(marine.router)
api_router.include_router(hazards.router)
api_router.include_router(forecasts.router)
api_router.include_router(investigations.router)
api_router.include_router(reports.router)
