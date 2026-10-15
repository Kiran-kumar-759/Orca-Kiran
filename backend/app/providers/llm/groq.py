from typing import Optional
import httpx
from app.providers.llm.base import LLMProvider
from app.core.config import settings
from app.core.logging import logger


class GroqProvider(LLMProvider):
    name: str = "groq"

    async def is_configured(self) -> bool:
        return bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1
    ) -> str:
        if not await self.is_configured():
            raise ValueError("Groq API key is not configured.")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": temperature
        }

        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
