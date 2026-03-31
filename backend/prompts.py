def build_summary_prompt(transcript: str) -> str:
    return f"""You are a summarization assistant. Analyze this transcript.
Respond ONLY with valid JSON, no extra text, no markdown backticks.

Transcript:
{transcript}

Respond with exactly this JSON format:
{{
  "summary": "A clear 3-4 sentence summary",
  "key_topics": ["topic 1", "topic 2", "topic 3", "topic 4", "topic 5"],
  "quick_summary": "One sentence summary"
}}"""


def build_notes_prompt(transcript: str) -> str:
    return f"""You are a study notes generator. Convert this video transcript into structured study notes.
Respond ONLY with valid JSON, no extra text, no markdown backticks.

Transcript:
{transcript}

Respond with exactly this JSON format:
{{
  "title": "Topic title in 5 words or less",
  "summary": "2-3 sentence overview of the video",
  "bullet_points": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"],
  "key_terms": [{{"term": "term name", "definition": "brief definition"}}, {{"term": "term2", "definition": "def2"}}],
  "important_facts": ["fact 1", "fact 2", "fact 3"]
}}"""


def build_quiz_prompt(transcript: str) -> str:
    return f"""You are a quiz generator. Create 5 multiple choice questions from this transcript.
Respond ONLY with valid JSON, no extra text, no markdown backticks.

Transcript:
{transcript}

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


def build_retriever_prompt(question: str, context: str) -> str:
    return f"""You are a Retriever Agent. Your job is to review the transcript
chunks retrieved for a user question and return them clearly organized.

User Question: {question}

Retrieved Transcript Chunks:
{context}

Return the chunks as-is, clearly numbered. Do not add any information
that is not in the chunks."""


def build_validator_prompt(question: str, organized_chunks: str) -> str:
    return f"""You are a Validator Agent. Assess whether the transcript excerpts contain ANY relevant information to answer the user's question, even partially.

User Question: {question}

Transcript Excerpts:
{organized_chunks}

- Return SUFFICIENT if the excerpts contain ANY related information
Rules:
- Return INSUFFICIENT only if the excerpts are completely unrelated
- Be lenient - partial information counts as SUFFICIENT

VERDICT: <SUFFICIENT or INSUFFICIENT>
Respond in this exact format:
REASONING: <one sentence>
RELEVANT CONTENT: <most relevant part or NONE>"""


def build_response_prompt(question: str, organized_chunks: str) -> str:
    return f"""You are a Response Generator Agent. Your job is to generate a
clear, accurate answer to the user's question based strictly on the provided
transcript excerpts. Do not use any outside knowledge.

User Question: {question}

Verified Transcript Excerpts:
{organized_chunks}

Generate a helpful, well-structured answer using only the transcript content above.
If something is partially covered, answer what you can and note the limitation."""
