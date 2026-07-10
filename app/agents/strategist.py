from typing import List, cast
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
from app.config import settings
from app.prompts import STRATEGIST_PROMPT

class Recommendation(BaseModel):
    title: str = Field(description="Short title for the recommendation.")
    description: str = Field(description="Detailed strategic recommendation.")

class StrategistOutput(BaseModel):
    recommendations: List[Recommendation]

def get_strategist_llm():
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not set")
    return ChatGroq(temperature=0.4, model="gemma2-9b-it", api_key=settings.groq_api_key) 

def run_strategist(insights: str) -> StrategistOutput:
    try:
        llm = get_strategist_llm()
        structured_llm = llm.with_structured_output(StrategistOutput)
        
        prompt = STRATEGIST_PROMPT.format(
            insights=insights
        )
        
        return cast(StrategistOutput, structured_llm.invoke(prompt))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Strategist failed: {e}")
        return StrategistOutput(recommendations=[Recommendation(title="Error", description="Failed to generate recommendations")])
