import re
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
from backend.cleaner import clean_transcript


def extract_video_id(url: str) -> str:
    """Extract video ID from various YouTube URL formats."""
    if not url or not url.strip():
        raise ValueError("URL cannot be empty.")

    patterns = [
        r"v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"embed/([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(
        "Invalid YouTube URL. Accepted formats:\n"
        "• https://www.youtube.com/watch?v=VIDEO_ID\n"
        "• https://youtu.be/VIDEO_ID"
    )


def get_transcript(video_id: str) -> str:
    """Fetch, clean and return the full transcript as a single string."""
    try:
        ytt = YouTubeTranscriptApi()
        fetched = ytt.fetch(video_id)
        raw = " ".join([entry.text for entry in fetched])

        if not raw.strip():
            raise RuntimeError("Transcript is empty for this video.")

        return clean_transcript(raw)

    except TranscriptsDisabled:
        raise RuntimeError(
            "Transcripts are disabled for this video. "
            "Try a different video."
        )
    except NoTranscriptFound:
        raise RuntimeError(
            "No transcript found for this video. "
            "The video may be private, age-restricted, or have no captions."
        )
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"Transcript extraction failed: {str(e)}")