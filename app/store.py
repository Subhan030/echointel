import datetime
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

@dataclass
class Competitor:
    id: int
    name: str
    domain: str
    industry: Optional[str] = None
    tracked_keywords: List[str] = field(default_factory=list)
    last_scraped_at: Optional[datetime.datetime] = None
    metadata_json: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Job:
    id: int
    competitor_id: int
    status: str = "queued"
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))
    completed_at: Optional[datetime.datetime] = None
    error_message: Optional[str] = None
    report_id: Optional[int] = None

@dataclass
class Report:
    id: int
    competitor_id: int
    generated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))
    summary: Optional[str] = None
    findings: Dict[str, Any] = field(default_factory=dict)
    raw_sources: List[str] = field(default_factory=list)
    status: str = "draft"

class Store:
    def __init__(self):
        self.competitors: Dict[int, Competitor] = {}
        self.jobs: Dict[int, Job] = {}
        self.reports: Dict[int, Report] = {}
        self._competitor_id = 1
        self._job_id = 1
        self._report_id = 1
        self._seed_data()

    def _seed_data(self):
        c1 = Competitor(id=self.next_competitor_id(), name="OpenAI", domain="openai.com", industry="Artificial Intelligence", last_scraped_at=datetime.datetime.now(datetime.timezone.utc))
        c2 = Competitor(id=self.next_competitor_id(), name="Stripe", domain="stripe.com", industry="Fintech", last_scraped_at=datetime.datetime.now(datetime.timezone.utc))
        c3 = Competitor(id=self.next_competitor_id(), name="Vercel", domain="vercel.com", industry="Web Development", last_scraped_at=datetime.datetime.now(datetime.timezone.utc))
        
        for c in [c1, c2, c3]:
            self.competitors[c.id] = c
            
            job = Job(id=self.next_job_id(), competitor_id=c.id, status="completed", completed_at=datetime.datetime.now(datetime.timezone.utc))
            self.jobs[job.id] = job
            
            report = Report(
                id=self.next_report_id(),
                competitor_id=c.id,
                status="completed",
                summary=f"{c.name} is a leading player in the {c.industry} space with strong market penetration and aggressive product velocity. Their recent focus indicates a push towards enterprise solutions.",
                findings={
                    "insights": [
                        {"category": "Product", "title": "New Enterprise Tier Launched", "details": f"{c.name} recently updated their pricing page to include a custom Enterprise tier with SOC2 compliance and dedicated support."},
                        {"category": "Marketing", "title": "Aggressive Content Marketing", "details": "We detected 15 new blog posts in the last month focused on developer tutorials and technical deep-dives."}
                    ],
                    "recommendations": [
                        {"title": "Match Enterprise Compliance", "description": "Ensure our enterprise offering highlights compliance certifications to remain competitive in RFPs."}
                    ]
                },
                raw_sources=[f"https://{c.domain}", f"https://{c.domain}/pricing"]
            )
            self.reports[report.id] = report
            job.report_id = report.id

    def next_competitor_id(self) -> int:
        curr = self._competitor_id
        self._competitor_id += 1
        return curr

    def next_job_id(self) -> int:
        curr = self._job_id
        self._job_id += 1
        return curr

    def next_report_id(self) -> int:
        curr = self._report_id
        self._report_id += 1
        return curr

store = Store()
