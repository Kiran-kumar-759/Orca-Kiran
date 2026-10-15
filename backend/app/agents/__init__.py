from app.agents.base import SpecialistAgent
from app.agents.coastal_risk.agent import CoastalRiskAgent
from app.agents.evidence_verification.agent import EvidenceVerificationAgent
from app.agents.marine_hazard.agent import MarineHazardAgent
from app.agents.ocean_research.agent import OceanResearchAgent

__all__ = [
    "CoastalRiskAgent",
    "EvidenceVerificationAgent",
    "MarineHazardAgent",
    "OceanResearchAgent",
    "SpecialistAgent",
]
