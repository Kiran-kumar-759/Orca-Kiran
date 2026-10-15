# ORCA Shared Evidence and Verification Contract

Evidence integrity is the foundational differentiator of ORCA. Factual claims must resolve to immutable evidence records.

## 1. Evidence Record Schema

```python
class EvidenceRecord(BaseModel):
    id: str  # e.g., "ev-om-20261015-001"
    dataset_id: str  # e.g., "open-meteo-marine", "noaa-ibtracs"
    source_name: str  # e.g., "Open-Meteo Marine API"
    source_url: Optional[str] = None
    retrieval_time: datetime  # UTC when ORCA fetched the data
    observation_time: Optional[datetime] = None  # Observation or forecast issue time
    valid_until_time: Optional[datetime] = None  # For forecasts
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coverage_area: Optional[str] = None  # GeoJSON or bounding box description
    variable: Optional[str] = None
    value: Optional[Union[float, int, str, dict, list]] = None
    unit: Optional[str] = None
    quality_flag: Optional[str] = "unvalidated"  # e.g. "verified", "suspect", "raw"
    license: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
```

## 2. Verification States

Agent 4 (Evidence & Scientific Verification Agent) assigns one of five definitive verification states:

| State | Definition |
|---|---|
| `verified` | Claim is mathematically and temporally supported by valid, accessible evidence. |
| `unverified` | Finding lacks direct evidence references or references unresolvable IDs. |
| `needs_review` | Evidence is present, but potential stale timestamps, unit discrepancies, or spatial mismatch require human inspection. |
| `conflicting` | Two or more referenced evidence records offer contradictory measurements without clear resolution. |
| `insufficient_evidence` | Data volume, temporal depth, or spatial resolution is inadequate to support the scope of the claim. |

## 3. Verification Audit Process

1. **Existence Check:** For every `evidence_id` in a `Finding`, verify that an `EvidenceRecord` exists in the registry.
2. **Temporal Consistency:** Ensure observation timestamp does not post-date retrieval time unless flagged as `is_forecast: true`.
3. **Unit Matching:** Ensure finding claim units match evidence record units or undergo verified deterministic conversion.
4. **Range / Physical Bounds Check:** Flag physical impossibilities (e.g., negative wave heights, SST > 40°C in open ocean).
5. **No Silent Mutation:** The Verification Agent cannot delete findings. It attaches a structured `VerificationResult` explaining any downgrades.
