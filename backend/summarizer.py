import os
import json
from groq import Groq
from dotenv import load_dotenv
from backend.prompts import build_summary_prompt

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def summarize_transcript(transcript: str) -> dict:
    """Generate a structured summary and key topics from transcript."""
    truncated = transcript[:6000] if len(transcript) > 6000 else transcript

    prompt = build_summary_prompt(truncated)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    if not response.choices or not response.choices[0].message or not response.choices[0].message.content:
        raise ValueError("Summarizer model returned an empty response.")
    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(text)
        return {
            "summary": result.get("summary", ""),
            "key_topics": result.get("key_topics", []),
            "quick_summary": result.get("quick_summary", "")
        }
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON returned by summarizer: {e}") from e
