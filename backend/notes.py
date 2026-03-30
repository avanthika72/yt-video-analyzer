import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def generate_notes(transcript: str) -> dict:
    """Generate structured study notes from transcript."""
    truncated = transcript[:6000] if len(transcript) > 6000 else transcript

    prompt = f"""You are a study notes generator. Convert this video transcript into structured study notes.
Respond ONLY with valid JSON, no extra text, no markdown backticks.

Transcript:
{truncated}

Respond with exactly this JSON format:
{{
  "title": "Topic title in 5 words or less",
  "summary": "2-3 sentence overview of the video",
  "bullet_points": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"],
  "key_terms": [{{"term": "term name", "definition": "brief definition"}}, {{"term": "term2", "definition": "def2"}}],
  "important_facts": ["fact 1", "fact 2", "fact 3"]
}}"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    import json
    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(text)
    except Exception:
        return {
            "title": "Study Notes",
            "summary": text,
            "bullet_points": [],
            "key_terms": [],
            "important_facts": []
        }