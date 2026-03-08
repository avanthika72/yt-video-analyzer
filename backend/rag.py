import os
from dotenv import load_dotenv
from backend.embeddings import retrieve_relevant_chunks
from backend.agents import run_multi_agent_pipeline

load_dotenv()


def answer_question(video_id: str, question: str) -> str:
    """
    Routes question through the multi-agent pipeline:
    Retriever Agent → Validator Agent → Response Generator Agent
    """
    result = run_multi_agent_pipeline(video_id, question)
    return result["answer"]


def answer_question_with_details(video_id: str, question: str) -> dict:
    """
    Same as answer_question but returns full agent reasoning.
    Useful for debugging and future transparency features.
    """
    return run_multi_agent_pipeline(video_id, question)