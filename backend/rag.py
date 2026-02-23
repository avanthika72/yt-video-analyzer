import os
from dotenv import load_dotenv
from groq import Groq
from backend.embeddings import retrieve_relevant_chunks

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def answer_question(video_id: str, question: str) -> str:
    """Retrieve relevant chunks and generate an answer using Groq."""
    chunks = retrieve_relevant_chunks(video_id, question)
    context = "\n\n".join(chunks)

    system_prompt = (
        "You are a helpful assistant that answers questions strictly based on "
        "the provided YouTube video transcript. Do not use any outside knowledge. "
        "If the answer is not in the transcript, say: "
        "'I couldn't find that information in the video.'"
    )

    user_prompt = f"""Transcript excerpts:
{context}

Question: {question}

Answer based only on the transcript above:"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content