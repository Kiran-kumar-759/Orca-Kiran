from app.orchestrator.events import global_event_bus
from app.orchestrator.service import global_orchestrator
from app.schemas.evidence import EvidenceRecord
from app.schemas.investigation import (
    ExecutionEvent,
    InvestigationCreate,
    InvestigationResponse,
)
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/investigations", tags=["Investigations"])


@router.post(
    "", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED
)
async def create_investigation(request: InvestigationCreate):
    """
    Submit a user query to execute an investigation across specialist agents.
    Triggers real orchestrator planning, execution, and scientific verification.
    """
    response = await global_orchestrator.execute_investigation(request)
    return response


@router.get("/{investigation_id}", response_model=InvestigationResponse)
async def get_investigation(investigation_id: str):
    """Retrieve the status, findings, and verification audit of an investigation."""
    inv = global_orchestrator.get_investigation(investigation_id)
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation '{investigation_id}' not found.",
        )
    return inv


@router.get("/{investigation_id}/events", response_model=list[ExecutionEvent])
async def get_investigation_events(investigation_id: str):
    """Retrieve chronological, genuine agent execution trace events."""
    events = global_event_bus.get_events(investigation_id)
    return events


@router.get("/{investigation_id}/evidence", response_model=list[EvidenceRecord])
async def get_investigation_evidence(investigation_id: str):
    """Retrieve all verifiable evidence records associated with the investigation."""
    evidence = global_orchestrator.get_evidence(investigation_id)
    return evidence
