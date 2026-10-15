from datetime import datetime, timezone
from typing import Any, Optional
import uuid
from app.schemas.investigation import ExecutionEvent, EventType
from app.core.logging import logger


class EventBus:
    """Manages and records real lifecycle execution events."""

    def __init__(self):
        self._events: dict[str, list[ExecutionEvent]] = {}

    def emit(
        self,
        investigation_id: str,
        event_type: EventType,
        agent_id: Optional[str] = None,
        payload: Optional[dict[str, Any]] = None
    ) -> ExecutionEvent:
        event = ExecutionEvent(
            id=f"evt-{uuid.uuid4().hex[:12]}",
            investigation_id=investigation_id,
            agent_id=agent_id,
            event_type=event_type.value,
            payload=payload or {},
            timestamp=datetime.now(timezone.utc)
        )
        if investigation_id not in self._events:
            self._events[investigation_id] = []
        self._events[investigation_id].append(event)
        logger.info(f"[EVENT] [{investigation_id}] {event_type.value} agent={agent_id}")
        return event

    def get_events(self, investigation_id: str) -> list[ExecutionEvent]:
        return self._events.get(investigation_id, [])


global_event_bus = EventBus()
