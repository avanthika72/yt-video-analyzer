# 🎬 YouTube Video Analyzer

An AI-powered app to analyze YouTube videos and answer questions about them using RAG.

## Setup

1. Clone the repo
```bash
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
```

2. Create and activate a virtual environment
```bash
   python -m venv .venv

   # Windows
   .venv\Scripts\activate

   # macOS
   source .venv/bin/activate
```

3. Install dependencies
```bash
   pip install -r backend/requirements.txt
```

4. Set up environment variables
```bash
   cp .env.example .env
   # Open .env and add your GROQ API key
```

5. Run the server
```bash
   uvicorn backend.main:app --reload
```

6. Open the app
   Visit: http://127.0.0.1:8000/static/index.html
   API docs: http://127.0.0.1:8000/docs

## Requirements
- Python 3.10 or 3.11 (recommended)
- Do not use Python 3.13 (dependency compatibility issues)

## Tech Stack
- FastAPI, ChromaDB, Sentence Transformers, LangChain, Groq

## Prompt Templates

All LLM prompt templates are centralized in `backend/prompts.py`.
The summarizer, notes generator, quiz generator, and multi-agent pipeline now import prompts from this file.
