from typing import Any

from fastapi import HTTPException, status


class OrcaBaseException(Exception):
    """Base exception for ORCA application."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ProviderUnavailableException(OrcaBaseException):
    """Raised when an external data or LLM provider is unreachable."""


class InvalidEvidenceException(OrcaBaseException):
    """Raised when an evidence record fails schema or provenance validation."""


class InvestigationNotFoundException(HTTPException):
    def __init__(self, investigation_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation '{investigation_id}' was not found.",
        )


class UnsupportedQueryException(HTTPException):
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Investigation request unsupported: {reason}",
        )
