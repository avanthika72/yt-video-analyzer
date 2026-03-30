import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def generate_quiz(transcript: str) -> list:
    """Generate MCQ quiz from transcript."""
    truncated = transcript[:6000] if len(transcript) > 6000 else transcript

    prompt = f"""You are a quiz generator. Create 5 multiple choice questions from this transcript.
Respond ONLY with valid JSON, no extra text, no markdown backticks.

Transcript:
{truncated}

Respond with exactly this JSON format:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }}
]

The "correct" field is the index (0-3) of the correct option in the options array.
Make all questions answerable strictly from the transcript."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(text)
    except Exception:
        return []