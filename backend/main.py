from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from backend.transcript import extract_video_id, get_transcript
from backend.embeddings import store_embeddings
from backend.rag import answer_question
from backend.cache import get_cached_video, cache_video, is_cached

app = FastAPI(title="YouTube Video Analyzer")

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
app.mount("/static", StaticFiles(directory="frontend"), name="static")


# --- Request/Response Models ---

class ProcessRequest(BaseModel):
    url: str

class ProcessResponse(BaseModel):
    video_id: str
    transcript_preview: str  # First 300 chars for UI confirmation
    message: str

class AskRequest(BaseModel):
    video_id: str
    question: str

class AskResponse(BaseModel):
    answer: str


# --- Endpoints ---

@app.get("/")
async def root():
    return {"message": "YouTube Analyzer API is running."}


@app.post("/process", response_model=ProcessResponse)
async def process_video(request: ProcessRequest):
    try:
        video_id = extract_video_id(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Return cached result if already processed
    if is_cached(video_id):
        cached = get_cached_video(video_id)
        return ProcessResponse(
            video_id=video_id,
            transcript_preview=cached["transcript"][:300],
            message="Video was already processed (loaded from cache).",
        )

    try:
        transcript = get_transcript(video_id)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    store_embeddings(video_id, transcript)
    cache_video(video_id, {"transcript": transcript})

    return ProcessResponse(
        video_id=video_id,
        transcript_preview=transcript[:300],
        message="Video processed successfully. You can now ask questions.",
    )


@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    if not is_cached(request.video_id):
        raise HTTPException(
            status_code=404,
            detail="Video not found. Please process the video first.",
        )
    try:
        answer = answer_question(request.video_id, request.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QA failed: {str(e)}")

    return AskResponse(answer=answer)