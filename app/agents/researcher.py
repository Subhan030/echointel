from typing import cast
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
from app.config import settings
from app.prompts import RESEARCHER_PROMPT

class ResearchSummary(BaseModel):
    summary: str = Field(description="Factual summary of the findings relevant to the task.")
    sources_used: list[str] = Field(description="List of URLs used to generate the summary.")

def get_researcher_llm():
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not set")
    return ChatGroq(temperature=0, model="llama-3.1-8b-instant", api_key=settings.groq_api_key) 

def run_researcher(task: str, findings: str) -> ResearchSummary:
    llm = get_researcher_llm()
    structured_llm = llm.with_structured_output(ResearchSummary)
    
    prompt = RESEARCHER_PROMPT.format(
        task=task,
        findings=findings
    )
    
    result = structured_llm.invoke(prompt)
    return cast(ResearchSummary, result)
