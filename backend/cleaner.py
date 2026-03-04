import re


# Sound/music tags like [Music], [Applause], [Laughter], (upbeat music) etc.
SOUND_TAG_PATTERNS = [
    r"♪[^♪]*♪",          # ♪ lyrics between notes ♪
    r"\[[^\]]*\]",        # [Music], [Applause], [Inaudible]
    r"\([^\)]*\)",        # (upbeat music), (crowd cheering)
    r"♪+",                # remaining lone music notes
    r"\[",                # any leftover stray opening bracket
    r"\]",                # any leftover stray closing bracket
]

# Filler words to removexs
FILLER_WORDS = [
    r"\bum+\b",
    r"\buh+\b",
    r"\bumm+\b",
    r"\buhh+\b",
    r"\byou know\b",
    r"\bi mean\b",
    r"\blike,?\b",
    r"\bbasically\b",
    r"\bactually\b",
    r"\bright\?\b",
    r"\bokay so\b",
    r"\bso yeah\b",
    r"\byeah so\b",
]


def remove_sound_tags(text: str) -> str:
    """Remove music, applause, and other sound annotation tags."""
    for pattern in SOUND_TAG_PATTERNS:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)
    return text


def remove_filler_words(text: str) -> str:
    """Remove common spoken filler words."""
    for pattern in FILLER_WORDS:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)
    return text


def fix_repeated_words(text: str) -> str:
    """Fix consecutive duplicate words like 'the the' or 'and and'."""
    return re.sub(r"\b(\w+)( \1\b)+", r"\1", text, flags=re.IGNORECASE)


def normalize_whitespace(text: str) -> str:
    """Collapse multiple spaces/newlines, remove leading/trailing whitespace."""
    text = re.sub(r"\n+", " ", text)      # newlines → single space
    text = re.sub(r" {2,}", " ", text)    # multiple spaces → single space
    return text.strip()


def normalize_punctuation(text: str) -> str:
    """Fix spacing around punctuation marks."""
    text = re.sub(r" ,", ",", text)   # space before comma
    text = re.sub(r" \.", ".", text)  # space before period
    text = re.sub(r" \?", "?", text)  # space before question mark
    text = re.sub(r" !", "!", text)   # space before exclamation
    return text


def clean_transcript(text: str) -> str:
    """
    Run full cleaning pipeline on raw transcript text.
    Order matters — remove tags first, then fillers, then fix artifacts.
    """
    text = remove_sound_tags(text)
    text = remove_filler_words(text)
    text = fix_repeated_words(text)
    text = normalize_whitespace(text)
    text = normalize_punctuation(text)
    return text