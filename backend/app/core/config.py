from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    GEMINI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    DEFAULT_LLM_PROVIDER: str = "groq"
    LLM_TEMPERATURE: float = 0.1
    LLM_TIMEOUT_SECONDS: int = 30

    # External APIs
    OPEN_METEO_BASE_URL: str = "https://marine-api.open-meteo.com/v1/marine"
    EXTERNAL_REQUEST_TIMEOUT_SECONDS: int = 20

    # Storage paths
    DATA_DIR: str = "data"

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
