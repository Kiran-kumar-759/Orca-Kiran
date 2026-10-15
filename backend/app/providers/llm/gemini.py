from typing import Optional
import httpx
from app.providers.llm.base import LLMProvider
from app.core.config import settings
from app.core.logging import logger


class GeminiProvider(LLMProvider):
    name: str = "gemini"

    async def is_configured(self) -> bool:
        return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1
    ) -> str:
        if not await self.is_configured():
            raise ValueError("Gemini API key is not configured.")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": f"System Instruction: {system_prompt}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = {
            "contents": contents,
            "generationConfig": {"temperature": temperature}
        }

        async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
