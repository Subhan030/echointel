from typing import List, Optional, Any
from app.store import store, Report

def get_report(report_id: int) -> Optional[Report]:
    return store.reports.get(report_id)

def get_reports_by_competitor(competitor_id: int) -> List[Report]:
    return [r for r in store.reports.values() if r.competitor_id == competitor_id]

def create_report(competitor_id: int, summary: str, findings: Any, raw_sources: List[str]) -> Report:
    report_id = store.next_report_id()
    new_report = Report(
        id=report_id,
        competitor_id=competitor_id,
        summary=summary,
        findings=findings,
        raw_sources=raw_sources,
        status="final"
    )
    store.reports[report_id] = new_report
    return new_report
