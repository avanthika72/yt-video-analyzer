from groq import Groq
import os
from dotenv import load_dotenv
from backend.embeddings import retrieve_relevant_chunks

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

ABBREVIATIONS = {
    "vdo": "video", "abt": "about", "wut": "what",
    "hw": "how", "r": "are", "u": "you", "ur": "your",
    "ppl": "people", "smth": "something", "cuz": "because",
    "thru": "through", "w/": "with", "w/o": "without",
    "imo": "in my opinion", "tbh": "to be honest",
    "idk": "I don't know", "pls": "please", "plz": "please",
    "tho": "though", "ngl": "not gonna lie",
    "rn": "right now", "irl": "in real life",
    "who posted": "who is the channel or uploader",
    "who uploaded": "who is the channel",
    "who made": "who created or published",
}


def groq_llm(prompt: str) -> str:
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return response.choices[0].message.content


def expand_abbreviations(text: str) -> str:
    words = text.split()
    expanded = [ABBREVIATIONS.get(word.lower(), word) for word in words]
    return " ".join(expanded)


def run_retriever_agent(video_id: str, question: str) -> dict:
    expanded_question = expand_abbreviations(question)
    chunks = retrieve_relevant_chunks(video_id, expanded_question, top_k=5)
    context = "\n\n".join(chunks)

    prompt = f"""You are a Retriever Agent. Review transcript chunks for a user question and return them clearly numbered.

User Question: {question}

Retrieved Transcript Chunks:
{context}

Return the chunks as-is, clearly numbered. Do not add any information not in the chunks."""

    result = groq_llm(prompt)
    return {"question": question, "raw_chunks": chunks, "organized_chunks": result}


def run_validator_agent(question: str, organized_chunks: str) -> dict:
    prompt = f"""You are a Validator Agent. Assess whether transcript excerpts contain ANY relevant information to answer the question, even partially.

User Question: {question}

Transcript Excerpts:
{organized_chunks}

Rules:
- Return SUFFICIENT if excerpts contain ANY related information (including metadata like title, channel name, video ID)
- Return INSUFFICIENT only if excerpts are completely unrelated
- Video metadata lines starting with [VIDEO METADATA] count as valid information
- Be lenient — partial information counts as SUFFICIENT

Respond in this exact format:
VERDICT: <SUFFICIENT or INSUFFICIENT>
REASONING: <one sentence>
RELEVANT CONTENT: <most relevant part or NONE>"""

    result = groq_llm(prompt)
    verdict = "SUFFICIENT"
    if "VERDICT: INSUFFICIENT" in result.upper():
        verdict = "INSUFFICIENT"
    return {"verdict": verdict, "validation_details": result}


def run_response_agent(question: str, organized_chunks: str, verdict: str) -> str:
    if verdict == "INSUFFICIENT":
        return "I couldn't find that information in the video."

    prompt = f"""You are a helpful assistant answering questions about a YouTube video.

STRICT RULES:
- Answer directly and concisely — 2 to 4 sentences maximum
- Never mention "transcript", "excerpts", "limitations", "fragmented", or "context"
- Never say you can't fully answer or that information is incomplete
- Never use academic or hedging language
- Answer like a knowledgeable friend would
- If asked about the channel, title, or who posted/uploaded the video, look for [VIDEO METADATA] lines in the content — they contain the title and channel name
- If it's about a song or creative content, give the gist in plain language

User Question: {question}

Video Content:
{organized_chunks}

Answer (short and direct):"""

    return groq_llm(prompt)


def run_multi_agent_pipeline(video_id: str, question: str) -> dict:
    retriever_output = run_retriever_agent(video_id, question)
    validator_output = run_validator_agent(
        question=question,
        organized_chunks=retriever_output["organized_chunks"],
    )
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