# Simple in-memory cache keyed by video_id
# Stores transcript text so we don't re-fetch for the same video
_cache: dict[str, dict] = {}


def get_cached_video(video_id: str) -> dict | None:
    return _cache.get(video_id)


def cache_video(video_id: str, data: dict) -> None:
    _cache[video_id] = data


def is_cached(video_id: str) -> bool:
    return video_id in _cache