from app.core.logging import logger
from app.schemas.evidence import EvidenceRecord


class EvidenceRegistry:
    """In-memory and transactional registry for verifiable evidence records."""

    def __init__(self):
        self._records: dict[str, EvidenceRecord] = {}

    def register(self, record: EvidenceRecord) -> None:
        if record.id in self._records:
            logger.debug(f"Evidence record {record.id} already exists; updating.")
        self._records[record.id] = record

    def register_many(self, records: list[EvidenceRecord]) -> None:
        for r in records:
            self.register(r)

    def get(self, evidence_id: str) -> EvidenceRecord | None:
        return self._records.get(evidence_id)

    def list_all(self) -> list[EvidenceRecord]:
        return list(self._records.values())

    def clear(self) -> None:
        self._records.clear()
