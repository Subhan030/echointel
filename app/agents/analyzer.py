from typing import List, cast
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
from app.config import settings
from app.prompts import ANALYZER_PROMPT

class Insight(BaseModel):
    category: str = Field(description="The category of insight (e.g. pricing, product, hiring).")
    details: str = Field(description="The details of the insight.")

class AnalyzerOutput(BaseModel):
    insights: List[Insight]

def get_analyzer_llm():
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not set")
    return ChatGroq(temperature=0.2, model="mixtral-8x7b-32768", api_key=settings.groq_api_key) 

def run_analyzer(synthesized_findings: str) -> AnalyzerOutput:
    try:
        llm = get_analyzer_llm()
        structured_llm = llm.with_structured_output(AnalyzerOutput)
        
        prompt = ANALYZER_PROMPT.format(
            synthesized_findings=synthesized_findings
        )
        
        return cast(AnalyzerOutput, structured_llm.invoke(prompt))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Analyzer failed: {e}")
        return AnalyzerOutput(insights=[Insight(category="error", details="Failed to parse insights")])
