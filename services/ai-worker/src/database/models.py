"""SQLAlchemy models matching Prisma schema."""

from datetime import datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class EpisodeStatus(str, Enum):
    """Episode generation status."""

    PENDING = "PENDING"
    SCRIPT_GENERATING = "SCRIPT_GENERATING"
    SCRIPT_GENERATED = "SCRIPT_GENERATED"
    AUDIO_GENERATING = "AUDIO_GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class EpisodeType(str, Enum):
    """Episode format type."""

    MONOLOGUE = "MONOLOGUE"
    DUO = "DUO"


class EpisodeTheme(str, Enum):
    """Episode presentation theme."""

    LECTURE = "LECTURE"
    DISCUSSION = "DISCUSSION"
    DEBATE = "DEBATE"


class ContentCoverage(str, Enum):
    """Book content coverage scope."""

    ENTIRE_BOOK = "ENTIRE_BOOK"
    MULTIPLE_CHAPTERS = "MULTIPLE_CHAPTERS"
    SINGLE_CHAPTER = "SINGLE_CHAPTER"


class Podcaster(Base):
    """Podcaster model - virtual AI podcast host."""

    __tablename__ = "podcasters"

    id = Column(String, primary_key=True)
    user_id = Column("userId", String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    profile_picture_url = Column("profilePictureUrl", String, nullable=True)

    # Voice characteristics
    voice_model = Column("voiceModel", String, nullable=False)
    gender = Column(String, nullable=False)  # MALE, FEMALE
    accent = Column(String, nullable=False)  # United States, United Kingdom, etc.
    speaking_speed = Column("speakingSpeed", Integer, default=5)  # 1-10
    vocal_pitch = Column("vocalPitch", Integer, default=5)  # 1-10
    age_tone = Column("ageTone", Integer, default=5)  # 1-10
    sentence_structure = Column("sentenceStructure", Integer, default=5)  # 1-10
    emotional_expression = Column("emotionalExpression", Integer, default=5)  # 1-10

    # Computed TTS Voice (set by core-api on create/update)
    gemini_voice_name = Column("geminiVoiceName", String, nullable=True)  # e.g., "Zephyr", "Aoede"

    # Personality traits
    tone = Column(Integer, default=5)  # 1-10
    communication_style = Column("communicationStyle", Integer, default=5)  # 1-10
    humor_level = Column("humorLevel", Integer, default=5)  # 1-10
    conversational_depth = Column("conversationalDepth", Integer, default=5)  # 1-10
    chaos_factor = Column("chaosFactor", Integer, default=5)  # 1-10

    # Knowledge & Worldview
    expertise_tags = Column("expertiseTags", ARRAY(String), default=[])
    intellectual_angle = Column("intellectualAngle", String, nullable=True)
    viewpoint_behavior = Column("viewpointBehavior", Integer, default=5)  # 1-10

    # Status
    is_public = Column("isPublic", Boolean, default=False)
    play_count = Column("playCount", Integer, default=0)
    like_count = Column("likeCount", Integer, default=0)
    share_count = Column("shareCount", Integer, default=0)

    # Timestamps
    created_at = Column("createdAt", DateTime, default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Book(Base):
    """Book model - source material for episodes."""

    __tablename__ = "books"

    id = Column(String, primary_key=True)
    user_id = Column("userId", String, nullable=False)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    isbn = Column(String, nullable=True)
    language = Column(String, default="en")
    page_count = Column("pageCount", Integer, nullable=True)

    # Source Information
    source_type = Column("sourceType", String, nullable=False)
    original_file_name = Column("originalFileName", String, nullable=True)

    # Storage
    file_storage_key = Column("fileStorageKey", String, nullable=False)
    file_size = Column("fileSize", Integer, nullable=True)
    file_mime_type = Column("fileMimeType", String, nullable=True)

    # Extraction Status
    extraction_status = Column("extractionStatus", String, default="PENDING")
    extraction_error = Column("extractionError", String, nullable=True)
    extracted_at = Column("extractedAt", DateTime, nullable=True)

    # Content
    full_text_key = Column("fullTextKey", String, nullable=True)

    # Timestamps
    created_at = Column("createdAt", DateTime, default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Chapter(Base):
    """Chapter model - extracted book content."""

    __tablename__ = "chapters"

    id = Column(String, primary_key=True)
    book_id = Column("bookId", String, nullable=False)
    chapter_number = Column("chapterNumber", Integer, nullable=False)
    title = Column(String, nullable=True)

    # Content Location
    start_page = Column("startPage", Integer, nullable=True)
    end_page = Column("endPage", Integer, nullable=True)
    text_length = Column("textLength", Integer, nullable=True)

    # Extracted Text
    extracted_text = Column("extractedText", Text, nullable=True)

    # Timestamps
    created_at = Column("createdAt", DateTime, default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Episode(Base):
    """Episode model - generated podcast episode."""

    __tablename__ = "episodes"

    id = Column(String, primary_key=True)
    user_id = Column("userId", String, nullable=False)
    podcaster_id = Column("podcasterId", String, nullable=False)
    book_id = Column("bookId", String, nullable=False)

    # Core content
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Content configuration
    content_coverage = Column("contentCoverage", String, nullable=False)  # ENTIRE_BOOK, MULTIPLE_CHAPTERS, SINGLE_CHAPTER
    chapters = Column(ARRAY(Integer), default=[])
    episode_type = Column("episodeType", String, nullable=False)  # MONOLOGUE, DUO
    episode_theme = Column("episodeTheme", String, nullable=False)  # LECTURE, DISCUSSION, DEBATE
    target_length_min = Column("targetLengthMin", Integer, nullable=False)
    target_length_max = Column("targetLengthMax", Integer, nullable=False)
    voice_tier = Column("voiceTier", String, default="STANDARD")  # STANDARD or GEMINI

    # Generated content
    script_content = Column("scriptContent", Text, nullable=True)
    audio_file_key = Column("audioFileKey", String, nullable=True)

    # Generation status
    generation_status = Column("generationStatus", String, default="PENDING")
    script_generated_at = Column("scriptGeneratedAt", DateTime, nullable=True)
    audio_generated_at = Column("audioGeneratedAt", DateTime, nullable=True)
    generation_error = Column("generationError", Text, nullable=True)

    # Audio properties
    duration = Column(Integer, nullable=True)  # seconds
    audio_format = Column("audioFormat", String, nullable=True)

    # Metadata
    is_public = Column("isPublic", Boolean, default=False)
    play_count = Column("playCount", Integer, default=0)
    like_count = Column("likeCount", Integer, default=0)
    share_count = Column("shareCount", Integer, default=0)

    # Timestamps
    created_at = Column("createdAt", DateTime, default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    """Notification model - user notifications for push delivery."""

    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column("userId", String, nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(String, nullable=False)
    data = Column(JSON, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow)
