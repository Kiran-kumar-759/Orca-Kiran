# ORCA Shared Specialist Agent Contract Specification

Every specialist agent in ORCA implements the identical execution contract defined in `backend/app/agents/base.py`.

## 1. Core Callable Protocol

```python
from abc import ABC, abstractmethod
from app.schemas.investigation import InvestigationTask, AgentResult

class SpecialistAgent(ABC):
    agent_id: str
    name: str
    description: str

    @abstractmethod
    async def run(self, task: InvestigationTask) -> AgentResult:
        """
        Execute specialist analysis for the provided task.
        Must return an AgentResult complying with the shared Pydantic contract.
        """
        pass
```

## 2. Shared Data Models

### InvestigationTask
```python
class InvestigationTask(BaseModel):
    investigation_id: str
    workspace: str  # fisherman | marine_monitoring | protected_areas | coastal_authority | disaster_management
    query: str
    location: Optional[LocationContext] = None
    time_window: Optional[TimeWindow] = None
    parameters: dict[str, Any] = Field(default_factory=dict)
```

### AgentResult
```python
class AgentExecutionStatus(str, Enum):
    COMPLETED = "completed"
    PARTIAL = "partial"
    UNAVAILABLE = "unavailable"
    FAILED = "failed"

class AgentResult(BaseModel):
    agent_id: str
    status: AgentExecutionStatus
    findings: list[Finding] = Field(default_factory=list)
    evidence: list[EvidenceRecord] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
```

### Finding
```python
class Finding(BaseModel):
    id: str
    claim: str
    value: Optional[Union[float, int, str, dict]] = None
    unit: Optional[str] = None
    evidence_ids: list[str] = Field(default_factory=list)
    uncertainty: Optional[str] = None
    is_forecast: bool = False
    observation_time: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
```

## 3. Strict Execution Guidelines

1. **No Silent Swallowing:** If a data provider is unreachable or returns an error, set `status = AgentExecutionStatus.PARTIAL` or `FAILED`, record the error in `errors`, and state the operational impact in `limitations`.
2. **Mandatory Evidence Linking:** Every `Finding` that asserts a numeric value or physical state must cite at least one `evidence_id` present in `evidence`.
3. **No Hallucinated Anomalies or Cones:** Only claim anomalies when baseline reference data exists and is included in the evidence.
