from abc import ABC, abstractmethod

from app.schemas.investigation import AgentResult, InvestigationTask


class SpecialistAgent(ABC):
    """
    Mandatory base class for all four ORCA specialist agents.
    Every agent must expose this asynchronous run contract.
    """

    agent_id: str
    name: str
    description: str

    @abstractmethod
    async def run(self, task: InvestigationTask) -> AgentResult:
        """
        Execute specialist analysis for the provided task.
        Must return an AgentResult complying with the shared contract.
        """
