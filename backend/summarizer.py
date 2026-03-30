import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def summarize_transcript(transcript: str) -> dict:
    """Generate a structured summary and key topics from transcript."""
    truncated = transcript[:6000] if len(transcript) > 6000 else transcript

    prompt = f"""You are a summarization assistant. Analyze this transcript.
Respond ONLY with valid JSON, no extra text, no markdown backticks.

Transcript:
{truncated}

Respond with exactly this JSON format:
{{
  "summary": "A clear 3-4 sentence summary",
  "key_topics": ["topic 1", "topic 2", "topic 3", "topic 4", "topic 5"],
  "quick_summary": "One sentence summary"
}}"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(text)
        return {
            "summary": result.get("summary", ""),
            "key_topics": result.get("key_topics", []),
            "quick_summary": result.get("quick_summary", "")
        }
    except Exception:
        return {
            "summary": text,
            "key_topics": [],
            "quick_summary": text[:100]
        }