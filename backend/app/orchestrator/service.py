import uuid
from datetime import UTC, datetime

from app.agents.base import SpecialistAgent
from app.agents.coastal_risk.agent import CoastalRiskAgent
from app.agents.evidence_verification.agent import EvidenceVerificationAgent
from app.agents.marine_hazard.agent import MarineHazardAgent
from app.agents.ocean_research.agent import OceanResearchAgent
from app.core.logging import logger
from app.db.repositories.hazard_repo import HazardRepository
from app.orchestrator.events import EventBus, global_event_bus
from app.orchestrator.planner import InvestigationPlanner
from app.providers.llm import get_active_llm_provider
from app.schemas.evidence import (
    EvidenceRecord,
    Finding,
    VerificationResult,
    VerificationState,
)
from app.schemas.investigation import (
    AgentResult,
    EventType,
    InvestigationCreate,
    InvestigationResponse,
    InvestigationTask,
)
from sqlalchemy.orm import Session


class OrchestratorService:
    """Coordinates specialist agents, event emission, verification, and result aggregation."""

    def __init__(self, event_bus: EventBus | None = None):
        self.event_bus = event_bus or global_event_bus
        self.planner = InvestigationPlanner()

        # Agent registry
        self.agents: dict[str, SpecialistAgent] = {
            "ocean_research": OceanResearchAgent(),
            "marine_hazard": MarineHazardAgent(),
            "coastal_risk": CoastalRiskAgent(),
        }
        self.verifier = EvidenceVerificationAgent()

        # In-memory store for investigations and their evidence pools
        self._investigations: dict[str, InvestigationResponse] = {}
        self._evidence_pools: dict[str, list[EvidenceRecord]] = {}

    async def execute_investigation(
        self, request: InvestigationCreate, db: Session | None = None
    ) -> InvestigationResponse:
        inv_id = f"inv-{uuid.uuid4().hex[:8]}"
        created_at = datetime.now(UTC)

        logger.info(
            f"Initiating investigation {inv_id} for workspace '{request.workspace}'"
        )

        # 1. Event: Investigation started
        self.event_bus.emit(
            investigation_id=inv_id,
            event_type=EventType.INVESTIGATION_STARTED,
            payload={"workspace": request.workspace, "query": request.query},
        )

        # 2. Plan specialist agents
        agent_ids = self.planner.plan_agents(request)
        task = InvestigationTask(
            investigation_id=inv_id,
            workspace=request.workspace,
            query=request.query,
            location=request.location,
            time_window=request.time_window,
            parameters={"db_session": db} if db is not None else {},
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

            # Inject database repository dynamically if available
            if aid == "marine_hazard" and db is not None and getattr(agent, "hazard_repo", None) is None:
                try:
                    agent.hazard_repo = HazardRepository(db)
                except Exception as repo_err:  # noqa: BLE001
                    logger.warning(f"Failed to attach HazardRepository to marine_hazard agent: {repo_err}")

            self.event_bus.emit(
                investigation_id=inv_id,
                event_type=EventType.AGENT_STARTED,
                agent_id=aid,
                payload={"name": agent.name},
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
                        payload={
                            "evidence_id": ev.id,
                            "source": ev.source_name,
                            "dataset": ev.dataset_id,
                        },
                    )

                all_findings.extend(result.findings)
                all_limitations.extend(result.limitations)

                self.event_bus.emit(
                    investigation_id=inv_id,
                    event_type=EventType.AGENT_COMPLETED,
                    agent_id=aid,
                    payload={
                        "status": result.status.value,
                        "findings_count": len(result.findings),
                    },
                )
            except Exception as e:  # noqa: BLE001
                logger.error(f"Error running agent {aid}: {e}")
                all_limitations.append(f"Agent {aid} failed during execution: {e!s}")

        # 4. Invoke Agent 4: Evidence & Scientific Verification
        verification_result: VerificationResult = self.verifier.verify_findings(
            findings=all_findings, evidence_pool=all_evidence
        )

        if verification_result.overall_state == VerificationState.VERIFIED:
            self.event_bus.emit(
                investigation_id=inv_id,
                event_type=EventType.VERIFICATION_PASSED,
                agent_id="evidence_verification",
                payload={"verified_count": verification_result.verified_claims_count},
            )
        else:
            self.event_bus.emit(
                investigation_id=inv_id,
                event_type=EventType.VERIFICATION_FAILED,
                agent_id="evidence_verification",
                payload={
                    "state": verification_result.overall_state.value,
                    "notes": verification_result.notes,
                },
            )

        # 5. Compile grounded synthesis summary (LLM or deterministic fallback)
        completed_at = datetime.now(UTC)
        summary, provider_used, model_used, is_fallback = await self._synthesize_workspace_response(
            request=request,
            findings=all_findings,
            evidence=all_evidence,
            limitations=list(set(all_limitations)),
            verification_result=verification_result,
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
            completed_at=completed_at,
            provider_used=provider_used,
            model_used=model_used,
            is_fallback=is_fallback,
        )

        self._investigations[inv_id] = response
        self._evidence_pools[inv_id] = all_evidence

        # 6. Event: Investigation completed
        self.event_bus.emit(
            investigation_id=inv_id,
            event_type=EventType.INVESTIGATION_COMPLETED,
            payload={
                "findings_count": len(all_findings),
                "evidence_count": len(all_evidence),
            },
        )

        return response

    async def _synthesize_workspace_response(
        self,
        request: InvestigationCreate,
        findings: list[Finding],
        evidence: list[EvidenceRecord],
        limitations: list[str],
        verification_result: VerificationResult,
    ) -> tuple[str, str, str, bool]:
        """
        Synthesize a structured, evidence-grounded workspace answer using the shared LLM provider
        when available, or a reliable deterministic rule engine when unconfigured or on failure.
        """
        provider = await get_active_llm_provider()

        if provider is not None:
            try:
                findings_text = "\n".join(
                    f"- [{f.id}] ({'FORECAST' if f.is_forecast else 'OBSERVED'}): {f.claim} "
                    f"(Value: {f.value} {f.unit or ''}, Uncertainty: {f.uncertainty or 'None'}, "
                    f"Evidence IDs: {', '.join(f.evidence_ids) if f.evidence_ids else 'None'})"
                    for f in findings
                ) or "No specialist findings recorded."

                limitations_text = "\n".join(f"- {lim}" for lim in limitations) or "None recorded."

                system_prompt = (
                    "You are the ORCA Multi-Agent Workspace Intelligence Synthesizer. "
                    "Your mission is to produce an authoritative, structured, and conversational response "
                    "answering the user's specific question strictly from verified specialist agent findings.\n\n"
                    "NON-NEGOTIABLE GROUNDING RULES:\n"
                    "1. Never invent or hallucinate wave heights, storm positions, wind speeds, or safety claims.\n"
                    "2. Base all statements exclusively on the provided specialist findings and cited evidence.\n"
                    "3. For marine safety / fishing questions:\n"
                    "   - Clearly distinguish between numerical forecast data, historical precedent, and official warnings.\n"
                    "   - NEVER claim that fishing or maritime operation is safe merely because no active tropical cyclone alert was found. Always evaluate the wave height and Douglas sea state.\n"
                    "   - State the Douglas sea state classification (e.g. Calm, Slight, Moderate, Rough) and its practical craft advisory.\n"
                    "   - Include observation/forecast timestamps and explicitly cite supporting evidence IDs (e.g. [ev-marine-wave-...]).\n"
                    "   - Explicitly state that numerical models provide situational guidance and do not replace statutory warnings from national authorities (e.g. IMD, Coast Guard).\n"
                    "4. If data is stale, missing, geographically irrelevant, or fallback-generated, state that clearly.\n"
                    "5. Structure your output with:\n"
                    "   - **Executive Advisory**: Direct, unambiguous answer to user query (e.g., CAUTION ADVISED / CONDITIONS FAVORABLE / HAZARDOUS).\n"
                    "   - **Sea State & Weather Conditions**: Concrete metrics, wave heights, sea scale, active alert status with cited evidence IDs.\n"
                    "   - **Scientific Audit & Limitations**: Verification state and known operational disclosures.\n"
                )

                user_prompt = (
                    f"User Query: {request.query}\n"
                    f"Workspace: {request.workspace}\n"
                    f"Target Location: {request.location.name if request.location else 'Unspecified'}\n"
                    f"Scientific Verification State: {verification_result.overall_state.value}\n\n"
                    f"SPECIALIST FINDINGS ({len(findings)}):\n{findings_text}\n\n"
                    f"LIMITATIONS & DISCLOSURES ({len(limitations)}):\n{limitations_text}\n\n"
                    "Provide your structured synthesis now."
                )

                resp = await provider.generate_response(user_prompt, system_prompt=system_prompt, temperature=0.1)
                if resp and resp.strip():
                    provider_name = provider.name
                    model_name = getattr(provider, "model", "default")
                    return resp.strip(), provider_name, model_name, False
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"Shared LLM workspace synthesis failed ({provider.name}): {e!s}. Falling back to deterministic rule engine."
                )

        # Fallback to Deterministic Synthesis Engine
        return self._deterministic_workspace_synthesis(request, findings, evidence, limitations, verification_result)

    def _deterministic_workspace_synthesis(
        self,
        request: InvestigationCreate,
        findings: list[Finding],
        evidence: list[EvidenceRecord],
        limitations: list[str],
        verification_result: VerificationResult,
    ) -> tuple[str, str, str, bool]:
        """
        High-reliability deterministic synthesis engine that constructs structured, truthful,
        and evidence-grounded answers without calling an external LLM.
        """
        loc_name = request.location.name if request.location else "Target Sector"
        q_lower = request.query.lower()
        is_marine_query = any(
            w in q_lower
            for w in [
                "fish",
                "wave",
                "hazard",
                "sea",
                "sail",
                "boat",
                "storm",
                "cyclone",
                "safe",
                "wind",
                "swell",
            ]
        ) or request.workspace in {"fisherman", "disaster_management", "coastal_authority"}

        lines: list[str] = []

        if is_marine_query:
            # 1. Inspect wave forecast
            wave_f = next(
                (f for f in findings if "f-marine-wave" in f.id or (f.unit == "meters" and "wave" in f.claim.lower())),
                None,
            )
            alert_f = [
                f for f in findings if "f-gdacs-" in f.id and "f-gdacs-clear" not in f.id and "distant" not in f.id
            ]
            clear_f = next((f for f in findings if "f-gdacs-clear" in f.id), None)
            hist_f = next((f for f in findings if "f-ibtracs" in f.id), None)

            # Determine Executive Advisory
            max_wave = float(wave_f.value) if wave_f and isinstance(wave_f.value, (int, float)) else None
            has_storm = len(alert_f) > 0

            if has_storm or (max_wave is not None and max_wave >= 4.0):
                advisory_status = "⚠️ **HAZARDOUS MARINE CONDITIONS — HIGH CAUTION REQUIRED**"
                advice = (
                    "Severe conditions or active cyclone advisories detected in the region. "
                    "Small craft and artisanal fishing operations should suspend offshore ventures."
                )
            elif max_wave is not None and max_wave >= 2.5:
                advisory_status = "⚠️ **ROUGH SEAS — SMALL CRAFT WARNING**"
                advice = (
                    "Significant wave energy with rough sea conditions predicted. "
                    "Artisanal and open fishing vessels should avoid offshore waters."
                )
            elif max_wave is not None and max_wave >= 1.25:
                advisory_status = "⚠️ **CAUTION ADVISED — MODERATE SEA STATE**"
                advice = (
                    "Moderate wave activity predicted (Douglas Degree 4). "
                    "Artisanal boats should exercise heightened vigilance, especially near sandbars and harbor approaches."
                )
            elif max_wave is not None:
                advisory_status = "✅ **CONDITIONS FAVORABLE — CALM TO SLIGHT SEAS**"
                advice = (
                    "Wave heights are within benign operational thresholds (<1.25 m) "
                    "and no regional cyclone alerts are active in the immediate sector."
                )
            else:
                advisory_status = "ℹ️ **CONDITIONS UNCONFIRMED — CAUTION ADVISED**"
                advice = (
                    "Live wave forecast was unavailable for this sector; "
                    "operators should not assume conditions are safe without local harbor clearance."
                )

            lines.append(f"### {advisory_status}\n")
            lines.append(f"**Direct Assessment for {loc_name}:** {advice}\n")

            lines.append("#### Key Verified Marine Findings:")
            if wave_f:
                ev_str = f" [{', '.join(wave_f.evidence_ids)}]" if wave_f.evidence_ids else ""
                lines.append(f"- **Sea State & Waves**: {wave_f.claim}{ev_str}")
            else:
                lines.append(f"- **Sea State & Waves**: Gridded wave forecast was not resolved for coordinates {loc_name}.")

            if alert_f:
                for af in alert_f:
                    ev_str = f" [{', '.join(af.evidence_ids)}]" if af.evidence_ids else ""
                    lines.append(f"- **Active Cyclone Alert**: {af.claim}{ev_str}")
            elif clear_f:
                ev_str = f" [{', '.join(clear_f.evidence_ids)}]" if clear_f.evidence_ids else ""
                lines.append(f"- **Cyclone Alerts**: {clear_f.claim}{ev_str} *(Note: Lack of cyclone alert does not imply calm waves)*")

            if hist_f:
                ev_str = f" [{', '.join(hist_f.evidence_ids)}]" if hist_f.evidence_ids else ""
                lines.append(f"- **Historical Benchmark**: {hist_f.claim}{ev_str}")
        else:
            # Generic structured synthesis for other workspaces
            lines.append(f"### Assessment for **{loc_name}** ({request.workspace.replace('_', ' ').title()})\n")
            lines.append(f"Multi-agent scientific investigation completed with {len(findings)} findings evaluated.\n")
            lines.append("#### Key Findings:")
            for f in findings:
                ev_str = f" [{', '.join(f.evidence_ids)}]" if f.evidence_ids else ""
                lines.append(f"- **{f.claim}**{ev_str}")

        # Verification & Disclosures
        lines.append("\n#### Scientific Audit & Disclosures:")
        lines.append(f"- **Verification State**: `{verification_result.overall_state.value}` ({verification_result.notes})")
        lines.append(
            "- **Statutory Guidance**: Numerical models provide decision support only. "
            "Statutory maritime signals and port closures are issued exclusively by national authorities (IMD / Coast Guard)."
        )

        if limitations:
            for lim in limitations[:3]:
                lines.append(f"- **Limitation**: {lim}")

        text = "\n".join(lines)
        return text, "deterministic_fallback", "deterministic_rule_engine", True

    def get_investigation(self, investigation_id: str) -> InvestigationResponse | None:
        return self._investigations.get(investigation_id)

    def get_evidence(self, investigation_id: str) -> list[EvidenceRecord]:
        return self._evidence_pools.get(investigation_id, [])


global_orchestrator = OrchestratorService()
