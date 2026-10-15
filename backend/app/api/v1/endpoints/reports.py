from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from app.schemas.report import InvestigationReportResponse
from app.orchestrator.service import global_orchestrator

router = APIRouter(prefix="/investigations", tags=["Reports"])


@router.get("/{investigation_id}/report", response_model=InvestigationReportResponse)
async def get_investigation_report(investigation_id: str):
    """Generate an evidence-linked scientific markdown report from the investigation result."""
    inv = global_orchestrator.get_investigation(investigation_id)
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation '{investigation_id}' not found."
        )

    evidence_list = global_orchestrator.get_evidence(investigation_id)

    # Deterministic report compilation
    markdown_lines = [
        f"# ORCA Scientific Intelligence Report",
        f"**Investigation ID:** `{inv.investigation_id}`  ",
        f"**Workspace:** {inv.workspace.title()}  ",
        f"**Date Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}  ",
        f"**Scientific Verification State:** `{inv.verification_summary.overall_state.value if inv.verification_summary else 'unverified'}`  ",
        f"\n---\n",
        f"## 1. Executive Summary",
        f"{inv.summary or 'No summary recorded.'}",
        f"\n## 2. Evidence-Backed Findings",
    ]

    for idx, f in enumerate(inv.findings, start=1):
        cited = ", ".join(f.evidence_ids) if f.evidence_ids else "None"
        val_str = f" `{f.value} {f.unit or ''}`" if f.value is not None else ""
        markdown_lines.append(f"### Finding {idx}: {f.claim}")
        markdown_lines.append(f"- **Measurement / Value:**{val_str}")
        markdown_lines.append(f"- **Cited Evidence IDs:** `{cited}`")
        if f.uncertainty:
            markdown_lines.append(f"- **Uncertainty Bounds:** {f.uncertainty}")

    markdown_lines.append(f"\n## 3. Cited Evidence Records")
    for ev in evidence_list:
        markdown_lines.append(
            f"- **`{ev.id}`**: {ev.source_name} ({ev.dataset_id}) | "
            f"Obs Time: {ev.observation_time or 'N/A'} | Quality: {ev.quality_flag}"
        )

    if inv.limitations:
        markdown_lines.append(f"\n## 4. Limitations & Disclosures")
        for lim in inv.limitations:
            markdown_lines.append(f"- {lim}")

    report_content = "\n".join(markdown_lines)

    return InvestigationReportResponse(
        investigation_id=inv.investigation_id,
        title=f"Scientific Report: {inv.query[:50]}",
        workspace=inv.workspace,
        generated_at=datetime.now(timezone.utc),
        markdown_content=report_content,
        findings_count=len(inv.findings),
        evidence_count=len(evidence_list),
        verification_summary=inv.verification_summary,
        limitations=inv.limitations
    )
