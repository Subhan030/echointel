from typing import List, cast
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
from app.config import settings
from app.prompts import PLANNER_PROMPT

class PlanItem(BaseModel):
    task: str = Field(description="The specific research task or question.")
    rationale: str = Field(description="Why this is important to research.")

class ResearchPlan(BaseModel):
    items: List[PlanItem]

def get_planner_llm():
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not set")
    return ChatGroq(temperature=0, model="deepseek-r1-distill-llama-70b", api_key=settings.groq_api_key) 

def run_planner(competitor_name: str, competitor_domain: str) -> ResearchPlan:
    try:
        llm = get_planner_llm()
        structured_llm = llm.with_structured_output(ResearchPlan)
        
        prompt = PLANNER_PROMPT.format(
            competitor_name=competitor_name, 
            competitor_domain=competitor_domain
        )
        
        return cast(ResearchPlan, structured_llm.invoke(prompt))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Planner failed: {e}")
        return ResearchPlan(items=[PlanItem(task="General overview", rationale="Fallback due to planner error")])
