from abc import ABC, abstractmethod
from typing import Optional


class LLMProvider(ABC):
    """Abstract interface for LLM integrations with fallback capability."""
    name: str

    @abstractmethod
    async def is_configured(self) -> bool:
        """Check if provider credentials are set."""
        pass

    @abstractmethod
    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1
    ) -> str:
        """Generate a completion response from the model."""
        pass
