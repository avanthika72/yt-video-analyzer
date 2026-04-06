import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def generate_notes(transcript: str) -> dict:
    # Use more of the transcript for richer notes — up to 10000 chars
    truncated = transcript[:10000] if len(transcript) > 10000 else transcript

    prompt = f"""You are an expert study notes generator. Your job is to create COMPREHENSIVE, DETAILED study notes from a video transcript — not a short summary.

RULES:
- bullet_points: Write AT LEAST 8-12 detailed bullet points, each 1-2 sentences explaining a specific concept, fact, or event from the video. Be specific, not generic.
- key_terms: Extract 6-10 important terms, names, places, or concepts with clear definitions based on the video content.
- important_facts: List 6-8 specific facts, statistics, quotes, or data points mentioned in the video.
- summary: Write a thorough 4-6 sentence paragraph overview of the entire video — what it covers, why it matters, key arguments or narrative.
- title: A clear descriptive title (max 8 words).

DO NOT repeat the same info across sections. Each section should add NEW information.
Respond ONLY with valid JSON, no markdown backticks, no preamble.

Transcript:
{truncated}

JSON format:
{{
  "title": "...",
  "summary": "...",
  "bullet_points": ["...", "...", "..."],
  "key_terms": [{{"term": "...", "definition": "..."}}],
  "important_facts": ["...", "...", "..."]
}}"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=2000,
    )

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