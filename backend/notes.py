import os
import json
from groq import Groq
from dotenv import load_dotenv
from backend.prompts import build_notes_prompt

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def generate_notes(transcript: str) -> dict:
    """Generate structured study notes from transcript."""
    truncated = transcript[:6000] if len(transcript) > 6000 else transcript

    prompt = build_notes_prompt(truncated)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    if not response.choices or not response.choices[0].message or not response.choices[0].message.content:
        raise ValueError("Notes model returned an empty response.")
    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON returned by notes generator: {e}") from e
