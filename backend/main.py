from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from backend.transcript import extract_video_id, get_transcript
from backend.embeddings import store_embeddings
from backend.rag import answer_question
from backend.cache import get_cached_video, cache_video, is_cached
from backend.summarizer import summarize_transcript
from backend.notes import generate_notes
from backend.quiz import generate_quiz

app = FastAPI(title="YouTube Video Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")


# --- Models ---

class ProcessRequest(BaseModel):
    url: str

class ProcessResponse(BaseModel):
    video_id: str
    transcript_preview: str
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
    if not request.url or not request.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty.")

    try:
        video_id = extract_video_id(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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

    if len(transcript.split()) < 20:
        raise HTTPException(
            status_code=422,
            detail="Transcript is too short to analyze meaningfully."
        )

    store_embeddings(video_id, transcript)
    cache_video(video_id, {"transcript": transcript})

    return ProcessResponse(
        video_id=video_id,
        transcript_preview=transcript[:300],
        message="Video processed successfully. You can now ask questions.",
    )


@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if len(request.question.strip()) < 3:
        raise HTTPException(status_code=400, detail="Question is too short.")

    if len(request.question) > 500:
        raise HTTPException(status_code=400, detail="Question too long. Keep under 500 characters.")

    if not is_cached(request.video_id):
        raise HTTPException(status_code=404, detail="Video not found. Please process the video first.")

    try:
        answer = answer_question(request.video_id, request.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QA failed: {str(e)}")

    return AskResponse(answer=answer)


@app.post("/summarize")
async def summarize(request: ProcessRequest):
    try:
        video_id = extract_video_id(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not is_cached(video_id):
        raise HTTPException(status_code=404, detail="Video not found. Please process the video first.")

    cached = get_cached_video(video_id)
    try:
        result = summarize_transcript(cached["transcript"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

    return result


@app.post("/notes")
async def notes(request: ProcessRequest):
    try:
        video_id = extract_video_id(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not is_cached(video_id):
        raise HTTPException(status_code=404, detail="Video not found. Please process the video first.")

    cached = get_cached_video(video_id)
    try:
        result = generate_notes(cached["transcript"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Notes generation failed: {str(e)}")

    return result


@app.post("/quiz")
async def quiz(request: ProcessRequest):
    try:
        video_id = extract_video_id(request.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not is_cached(video_id):
        raise HTTPException(status_code=404, detail="Video not found. Please process the video first.")

    cached = get_cached_video(video_id)
    try:
        result = generate_quiz(cached["transcript"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")

    return {"questions": result}