import datetime
from typing import Optional
from app.store import store, Job

def get_job(job_id: int) -> Optional[Job]:
    return store.jobs.get(job_id)

def create_job(competitor_id: int) -> Job:
    job_id = store.next_job_id()
    new_job = Job(id=job_id, competitor_id=competitor_id)
    store.jobs[job_id] = new_job
    return new_job

def update_job_status(job_id: int, status: str, error_message: Optional[str] = None, report_id: Optional[int] = None) -> Optional[Job]:
    job = get_job(job_id)
    if job:
        job.status = status
        if error_message:
            job.error_message = error_message
        if report_id:
            job.report_id = report_id
        if status in ["completed", "failed"]:
            job.completed_at = datetime.datetime.now(datetime.timezone.utc)
    return job
