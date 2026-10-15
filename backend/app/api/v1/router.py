from app.api.v1.endpoints import (
    hazards,
    health,
    investigations,
    marine,
    reports,
)
from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(marine.router)
api_router.include_router(hazards.router)
api_router.include_router(investigations.router)
api_router.include_router(reports.router)
