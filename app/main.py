from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, cast
import uuid
import os
import logging
import threading

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from apscheduler.schedulers.background import BackgroundScheduler

from app.schemas import CompetitorCreate, CompetitorResponse, JobResponse, ReportResponse
from app.crud.competitor import create_competitor, get_competitors, get_competitor, delete_competitor
from app.crud.job import create_job, get_job
from app.crud.report import get_report, get_reports_by_competitor
from app.graph.workflow import run_pipeline
from app.logger import setup_logging, request_id_var


setup_logging()
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

scheduler = BackgroundScheduler()

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(scheduled_competitor_check, 'interval', hours=24)
    scheduler.start()
    logger.info("APScheduler started")
    yield
    scheduler.shutdown()
    logger.info("APScheduler shutdown")

app = FastAPI(title="EchoIntel API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler) # type: ignore

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_request_id_middleware(request: Request, call_next):
    req_id = str(uuid.uuid4())
    request_id_var.set(req_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = req_id
    return response

def scheduled_competitor_check():
    try:
        competitors = get_competitors(limit=100)
        logger.info(f"Running scheduled check for {len(competitors)} competitors.")
        for comp in competitors:
            job = create_job(comp.id)
            threading.Thread(target=run_pipeline, args=(comp.id, comp.name, comp.domain, job.id)).start()
    except Exception as e:
        logger.error(f"Error in scheduled check: {e}")

@app.get("/")
def root():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")

@app.get("/health")
@limiter.limit("60/minute")
def health_check(request: Request):
    return {"status": "ok", "db_url_configured": True} 

@app.post("/competitors", response_model=CompetitorResponse)
@limiter.limit("10/minute")
def add_competitor(request: Request, competitor: CompetitorCreate):
    return create_competitor(competitor.model_dump())

@app.get("/competitors", response_model=List[CompetitorResponse])
def list_competitors(skip: int = 0, limit: int = 100):
    return get_competitors(skip=skip, limit=limit)

@app.get("/competitors/{competitor_id}", response_model=CompetitorResponse)
def get_competitor_detail(competitor_id: int):
    comp = get_competitor(competitor_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return comp

@app.delete("/competitors/{competitor_id}")
def remove_competitor(competitor_id: int):
    success = delete_competitor(competitor_id)
    if not success:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return {"status": "success"}

@app.post("/competitors/{competitor_id}/run", response_model=JobResponse)
@limiter.limit("5/minute")
def trigger_pipeline_run(request: Request, competitor_id: int, background_tasks: BackgroundTasks):
    comp = get_competitor(competitor_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
    
    job = create_job(competitor_id)
    
    background_tasks.add_task(
        run_pipeline,
        competitor_id=comp.id,
        competitor_name=comp.name,
        competitor_domain=comp.domain,
        job_id=job.id
    )
    
    return job

@app.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: int):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/reports/{report_id}", response_model=ReportResponse)
def get_report_detail(report_id: int):
    rep = get_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found")
    return rep

@app.get("/competitors/{competitor_id}/reports", response_model=List[ReportResponse])
def list_competitor_reports(competitor_id: int):
    return get_reports_by_competitor(competitor_id)


