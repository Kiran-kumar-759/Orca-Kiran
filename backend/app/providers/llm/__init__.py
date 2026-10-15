from typing import Optional
from app.providers.llm.base import LLMProvider
from app.providers.llm.groq import GroqProvider
from app.providers.llm.gemini import GeminiProvider
from app.providers.llm.openrouter import OpenRouterProvider
from app.core.config import settings
from app.core.logging import logger

_providers: list[LLMProvider] = [
    GroqProvider(),
    GeminiProvider(),
    OpenRouterProvider(),
]


async def get_active_llm_provider() -> Optional[LLMProvider]:
    """
    Returns the first configured LLM provider according to priority:
    1. Groq
    2. Gemini
    3. OpenRouter
    Returns None if no keys are configured.
    """
    for provider in _providers:
        if await provider.is_configured():
            return provider
    return None


__all__ = [
    "LLMProvider",
    "GroqProvider",
    "GeminiProvider",
    "OpenRouterProvider",
    "get_active_llm_provider",
]
