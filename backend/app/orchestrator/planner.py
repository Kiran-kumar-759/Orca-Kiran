from typing import ClassVar

from app.schemas.investigation import InvestigationCreate


class InvestigationPlanner:
    """Plans specialist agent selection based on workspace context and user query."""

    WORKSPACE_AGENT_MAPPING: ClassVar[dict[str, list[str]]] = {
        "fisherman": ["ocean_research", "marine_hazard"],
        "marine_monitoring": ["ocean_research"],
        "protected_areas": ["ocean_research", "coastal_risk"],
        "coastal_authority": ["coastal_risk", "marine_hazard"],
        "disaster_management": ["marine_hazard", "coastal_risk"],
    }

    def plan_agents(self, request: InvestigationCreate) -> list[str]:
        if request.preferred_agents:
            return request.preferred_agents

        workspace_key = request.workspace.lower().strip()
        agents = self.WORKSPACE_AGENT_MAPPING.get(workspace_key)
        if not agents:
            # Default to Ocean Research and Marine Hazard
            agents = ["ocean_research", "marine_hazard"]

        # If query contains explicit keywords, dynamically expand
        q = request.query.lower()
        if (
            any(
                w in q
                for w in [
                    "cyclone",
                    "storm",
                    "hurricane",
                    "typhoon",
                    "hazard",
                    "wave",
                    "swell",
                    "sea state",
                    "rough sea",
                    "rough",
                    "fishing safety",
                    "warning",
                    "advisory",
                ]
            )
            and "marine_hazard" not in agents
        ):
            agents.append("marine_hazard")
        if (
            any(
                w in q
                for w in [
                    "population",
                    "settlement",
                    "infrastructure",
                    "port",
                    "vulnerability",
                    "exposure",
                ]
            )
            and "coastal_risk" not in agents
        ):
            agents.append("coastal_risk")
        if (
            any(
                w in q
                for w in [
                    "sst",
                    "temperature",
                    "chlorophyll",
                    "salinity",
                    "current",
                    "upwelling",
                    "anomaly",
                ]
            )
            and "ocean_research" not in agents
        ):
            agents.append("ocean_research")

        return agents
