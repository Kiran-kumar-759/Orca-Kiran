from app.providers.llm.base import LLMProvider
from app.providers.llm.gemini import GeminiProvider
from app.providers.llm.groq import GroqProvider
from app.providers.llm.openrouter import OpenRouterProvider

_providers: list[LLMProvider] = [
    GroqProvider(),
    GeminiProvider(),
    OpenRouterProvider(),
]


async def get_active_llm_provider() -> LLMProvider | None:
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
    "GeminiProvider",
    "GroqProvider",
    "LLMProvider",
    "OpenRouterProvider",
    "get_active_llm_provider",
]
