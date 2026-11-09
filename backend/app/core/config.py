from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_project_root = Path(__file__).resolve().parents[3]
_backend_root = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    PROJECT_NAME: str = "ORCA — Marine & Coastal Intelligence Platform"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_STR: str = "/api/v1"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # PostgreSQL Connection URL (psycopg 3)
    DATABASE_URL: str = "postgresql+psycopg://orca:orca@localhost:5432/orca_db"
    DB_ECHO: bool = False

    # LLM Providers (Priority: Groq -> Gemini -> OpenRouter)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_FALLBACK_MODEL: str = "qwen/qwen3.8-27b"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-latest"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3.3-70b-instruct"
    DEFAULT_LLM_PROVIDER: str = "groq"
    LLM_TEMPERATURE: float = 0.1
    LLM_TIMEOUT_SECONDS: int = 30

    # External APIs
    OPEN_METEO_BASE_URL: str = "https://marine-api.open-meteo.com/v1/marine"
    EXTERNAL_REQUEST_TIMEOUT_SECONDS: int = 20

    # P2-05: Provider Freshness Thresholds (Hours)
    GDACS_FRESHNESS_HOURS: int = 6
    OPEN_METEO_FRESHNESS_HOURS: int = 12
    NOAA_NHC_FRESHNESS_HOURS: int = 6

    # P2-05: Provider Retry & Resilience Parameters
    MAX_PROVIDER_RETRIES: int = 2
    RETRY_BASE_DELAY_SECONDS: float = 0.5
    MAX_RETRY_DELAY_SECONDS: float = 5.0

    # Storage paths
    DATA_DIR: str = "data"

    # CORS Configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=(
            str(_project_root / ".env"),
            str(_backend_root / ".env"),
            ".env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
