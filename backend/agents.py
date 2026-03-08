from crewai import Agent, Task, Crew, Process
from backend.embeddings import retrieve_relevant_chunks
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def groq_llm(prompt: str) -> str:
    """Shared LLM call used by all agents."""
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return response.choices[0].message.content


# ─── Agent 1: Retriever Agent ────────────────────────────────────────────────

def run_retriever_agent(video_id: str, question: str) -> dict:
    """
    Retrieves the most semantically relevant transcript chunks
    for the given question using ChromaDB similarity search.
    """
    chunks = retrieve_relevant_chunks(video_id, question, top_k=5)
    context = "\n\n".join(chunks)

    prompt = f"""You are a Retriever Agent. Your job is to review the transcript 
chunks retrieved for a user question and return them clearly organized.

User Question: {question}

Retrieved Transcript Chunks:
{context}

Return the chunks as-is, clearly numbered. Do not add any information 
that is not in the chunks."""

    result = groq_llm(prompt)

    return {
        "question": question,
        "raw_chunks": chunks,
        "organized_chunks": result,
    }


# ─── Agent 2: Validator Agent ─────────────────────────────────────────────────

def run_validator_agent(question: str, organized_chunks: str) -> dict:
    """
    Validates whether the retrieved chunks contain sufficient
    information to answer the question. Returns a verdict and reasoning.
    """
    prompt = f"""You are a Validator Agent. Your job is to assess whether the 
provided transcript excerpts contain enough information to answer the user's question.

User Question: {question}

Transcript Excerpts:
{organized_chunks}

Respond in this exact format:
VERDICT: <SUFFICIENT or INSUFFICIENT>
REASONING: <one sentence explaining your verdict>
RELEVANT CONTENT: <quote the most relevant part of the excerpts, or say NONE>"""

    result = groq_llm(prompt)

    # parse verdict from response
    verdict = "SUFFICIENT"
    if "INSUFFICIENT" in result.upper():
        verdict = "INSUFFICIENT"

    return {
        "verdict": verdict,
        "validation_details": result,
    }


# ─── Agent 3: Response Generator Agent ───────────────────────────────────────

def run_response_agent(question: str, organized_chunks: str, verdict: str) -> str:
    """
    Generates the final answer based on validated transcript content.
    If validator said INSUFFICIENT, returns a graceful fallback message.
    """
    if verdict == "INSUFFICIENT":
        return "I couldn't find that information in the video."

    prompt = f"""You are a Response Generator Agent. Your job is to generate a 
clear, accurate answer to the user's question based strictly on the provided 
transcript excerpts. Do not use any outside knowledge.

User Question: {question}

Verified Transcript Excerpts:
{organized_chunks}

Generate a helpful, well-structured answer using only the transcript content above.
If something is partially covered, answer what you can and note the limitation."""

    return groq_llm(prompt)


# ─── Orchestrator ─────────────────────────────────────────────────────────────

def run_multi_agent_pipeline(video_id: str, question: str) -> dict:
    """
    Orchestrates all three agents in sequence:
    Retriever → Validator → Response Generator

    Returns the final answer along with agent reasoning for transparency.
    """

    # Agent 1: Retrieve
    retriever_output = run_retriever_agent(video_id, question)

    # Agent 2: Validate
    validator_output = run_validator_agent(
        question=question,
        organized_chunks=retriever_output["organized_chunks"],
    )

    # Agent 3: Generate
    final_answer = run_response_agent(
        question=question,
        organized_chunks=retriever_output["organized_chunks"],
        verdict=validator_output["verdict"],
    )

    return {
        "answer": final_answer,
        "verdict": validator_output["verdict"],
        "validation_reasoning": validator_output["validation_details"],
    }