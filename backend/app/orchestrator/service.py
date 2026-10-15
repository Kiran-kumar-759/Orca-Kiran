from datetime import datetime, timezone
from typing import Optional, Dict
import uuid

from app.schemas.investigation import (
    InvestigationCreate,
    InvestigationResponse,
    InvestigationTask,
    AgentResult,
    EventType,
)
from app.schemas.evidence import Finding, EvidenceRecord, VerificationResult, VerificationState
from app.orchestrator.planner import InvestigationPlanner
from app.orchestrator.events import global_event_bus, EventBus
from app.agents.base import SpecialistAgent
from app.agents.ocean_research.agent import OceanResearchAgent
from app.agents.marine_hazard.agent import MarineHazardAgent
from app.agents.coastal_risk.agent import CoastalRiskAgent
from app.agents.evidence_verification.agent import EvidenceVerificationAgent
from app.core.logging import logger


class OrchestratorService:
    """Coordinates specialist agents, event emission, verification, and result aggregation."""

    def __init__(self, event_bus: Optional[EventBus] = None):
        self.event_bus = event_bus or global_event_bus
        self.planner = InvestigationPlanner()
        
        # Agent registry
        self.agents: Dict[str, SpecialistAgent] = {
            "ocean_research": OceanResearchAgent(),
            "marine_hazard": MarineHazardAgent(),
            "coastal_risk": CoastalRiskAgent(),
        }
        self.verifier = EvidenceVerificationAgent()

        # In-memory store for investigations and their evidence pools
        self._investigations: Dict[str, InvestigationResponse] = {}
        self._evidence_pools: Dict[str, list[EvidenceRecord]] = {}

    async def execute_investigation(self, request: InvestigationCreate) -> InvestigationResponse:
        inv_id = f"inv-{uuid.uuid4().hex[:8]}"
        created_at = datetime.now(timezone.utc)

        logger.info(f"Initiating investigation {inv_id} for workspace '{request.workspace}'")

        # 1. Event: Investigation started
        self.event_bus.emit(
            investigation_id=inv_id,
            event_type=EventType.INVESTIGATION_STARTED,
            payload={"workspace": request.workspace, "query": request.query}
        )

        # 2. Plan specialist agents
        agent_ids = self.planner.plan_agents(request)
        task = InvestigationTask(
            investigation_id=inv_id,
            workspace=request.workspace,
            query=request.query,
            location=request.location,
            time_window=request.time_window
        )

        all_findings: list[Finding] = []
        all_evidence: list[EvidenceRecord] = []
        all_limitations: list[str] = []

        # 3. Execute specialist agents
        for aid in agent_ids:
            agent = self.agents.get(aid)
            if not agent:
                logger.warning(f"Agent '{aid}' requested but not found in registry.")
                continue

            self.event_bus.emit(
                investigation_id=inv_id,
                event_type=EventType.AGENT_STARTED,
                agent_id=aid,
                payload={"name": agent.name}
            )

            try:
                result: AgentResult = await agent.run(task)
                
                # Register evidence
                for ev in result.evidence:
                    all_evidence.append(ev)
                    self.event_bus.emit(
                        investigation_id=inv_id,
                        event_type=EventType.EVIDENCE_ADDED,
                        agent_id=aid,
                        payload={"evidence_id": ev.id, "source": ev.source_name, "dataset": ev.dataset_id}
                    )

                all_findings.extend(result.findings)
                all_limitations.extend(result.limitations)

                self.event_bus.emit(
                    investigation_id=inv_id,
                    event_type=EventType.AGENT_COMPLETED,
                    agent_id=aid,
                    payload={"status": result.status.value, "findings_count": len(result.findings)}
                )
            except Exception as e:
                logger.error(f"Error running agent {aid}: {e}")
                all_limitations.append(f"Agent {aid} failed during execution: {str(e)}")

        # 4. Invoke Agent 4: Evidence & Scientific Verification
        verification_result: VerificationResult = self.verifier.verify_findings(
            findings=all_findings,
            evidence_pool=all_evidence
        )

        if verification_result.overall_state == VerificationState.VERIFIED:
            self.event_bus.emit(
                investigation_id=inv_id,
                event_type=EventType.VERIFICATION_PASSED,
                agent_id="evidence_verification",
                payload={"verified_count": verification_result.verified_claims_count}
            )
        else:
            self.event_bus.emit(
                investigation_id=inv_id,
                event_type=EventType.VERIFICATION_FAILED,
                agent_id="evidence_verification",
                payload={"state": verification_result.overall_state.value, "notes": verification_result.notes}
            )

        # 5. Compile synthesis summary
        completed_at = datetime.now(timezone.utc)
        summary = (
            f"Investigation for '{request.query}' completed across {len(agent_ids)} specialist agents. "
            f"Produced {len(all_findings)} scientific findings supported by {len(all_evidence)} verifiable evidence records. "
            f"Scientific verification status: {verification_result.overall_state.value}."
        )

        response = InvestigationResponse(
            investigation_id=inv_id,
            workspace=request.workspace,
            status="completed",
            query=request.query,
            summary=summary,
            location=request.location,
            time_window=request.time_window,
            findings=all_findings,
            verification_summary=verification_result,
            limitations=list(set(all_limitations)),
            created_at=created_at,
            completed_at=completed_at
        )

        self._investigations[inv_id] = response
        self._evidence_pools[inv_id] = all_evidence

        # 6. Event: Investigation completed
        self.event_bus.emit(
            investigation_id=inv_id,
            event_type=EventType.INVESTIGATION_COMPLETED,
            payload={"findings_count": len(all_findings), "evidence_count": len(all_evidence)}
        )

        return response

    def get_investigation(self, investigation_id: str) -> Optional[InvestigationResponse]:
        return self._investigations.get(investigation_id)

    def get_evidence(self, investigation_id: str) -> list[EvidenceRecord]:
        return self._evidence_pools.get(investigation_id, [])


global_orchestrator = OrchestratorService()
