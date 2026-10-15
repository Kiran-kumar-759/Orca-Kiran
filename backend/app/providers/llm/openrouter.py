import httpx
from app.core.config import settings
from app.providers.llm.base import LLMProvider


class OpenRouterProvider(LLMProvider):
    name: str = "openrouter"

    async def is_configured(self) -> bool:
        return bool(settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY.strip())

    async def generate_response(
        self, prompt: str, system_prompt: str | None = None, temperature: float = 0.1
    ) -> str:
        if not await self.is_configured():
            raise ValueError("OpenRouter API key is not configured.")

        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/orca-ocean/orca",
            "X-Title": "ORCA Marine Intelligence",
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": "meta-llama/llama-3.3-70b-instruct",
            "messages": messages,
            "temperature": temperature,
        }

        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
