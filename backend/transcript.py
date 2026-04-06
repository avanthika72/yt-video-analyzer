import re
import urllib.request
import json
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


def fetch_video_metadata(video_id: str) -> dict:
    """
    Fetch basic video metadata via YouTube oEmbed (no API key needed).
    Returns title, author_name, thumbnail_url.
    """
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        with urllib.request.urlopen(oembed_url, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            return {
                "title": data.get("title", "Unknown"),
                "channel": data.get("author_name", "Unknown"),
                "video_id": video_id,
                "url": f"https://www.youtube.com/watch?v={video_id}",
            }
    except Exception:
        return {
            "title": "Unknown",
            "channel": "Unknown",
            "video_id": video_id,
            "url": f"https://www.youtube.com/watch?v={video_id}",
        }


def get_transcript(video_id: str) -> str:
    """
    Fetch transcript and prepend video metadata so the AI can answer
    questions about the video title, channel, uploader etc.
    """
    # Fetch metadata first
    meta = fetch_video_metadata(video_id)

    # Build a metadata header that gets embedded into the transcript context
    meta_header = (
        f"[VIDEO METADATA] "
        f"Title: {meta['title']} | "
        f"Channel: {meta['channel']} | "
        f"URL: {meta['url']} | "
        f"Video ID: {video_id}"
    )

    try:
        ytt = YouTubeTranscriptApi()
        fetched = ytt.fetch(video_id)
        raw = " ".join([entry.text for entry in fetched])
        if not raw.strip():
            raise RuntimeError("Transcript is empty for this video.")
        cleaned = clean_transcript(raw)
        # Prepend metadata so embeddings include it
        return f"{meta_header}\n\n{cleaned}"
    except TranscriptsDisabled:
        raise RuntimeError("Transcripts are disabled for this video. Try a different video.")
    except NoTranscriptFound:
        raise RuntimeError("No transcript found. The video may be private, age-restricted, or have no captions.")
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"Transcript extraction failed: {str(e)}")