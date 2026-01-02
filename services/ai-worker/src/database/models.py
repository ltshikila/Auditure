"""SQLAlchemy models matching Prisma schema."""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    ARRAY,
)
from sqlalchemy.orm import declarative_base, relationship

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
    GROUP = "GROUP"


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
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    tagline = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    profile_picture_url = Column(String, nullable=True)

    # Voice characteristics
    gender = Column(String, nullable=False)  # MALE, FEMALE
    accent = Column(String, nullable=False)  # United States, United Kingdom, etc.
    speaking_speed = Column(Integer, default=5)  # 1-10
    vocal_pitch = Column(Integer, default=5)  # 1-10

    # Personality traits
    tone = Column(Integer, default=5)  # 1-10
    communication_style = Column(Integer, default=5)  # 1-10
    humor_level = Column(Integer, default=5)  # 1-10
    conversational_depth = Column(Integer, default=5)  # 1-10
    chaos_factor = Column(Integer, default=5)  # 1-10
    intellectual_angle = Column(String, nullable=True)
    expertise_tags = Column(ARRAY(String), default=[])

    # Status
    is_public = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    episodes = relationship("Episode", back_populates="podcaster")


class Book(Base):
    """Book model - source material for episodes."""

    __tablename__ = "books"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    cover_image_url = Column(String, nullable=True)
    file_key = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    total_pages = Column(Integer, nullable=True)
    extraction_status = Column(String, default="PENDING")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    chapters = relationship("Chapter", back_populates="book")
    episodes = relationship("Episode", back_populates="book")


class Chapter(Base):
    """Chapter model - extracted book content."""

    __tablename__ = "chapters"

    id = Column(String, primary_key=True)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String, nullable=True)
    extracted_text = Column(Text, nullable=True)
    word_count = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    book = relationship("Book", back_populates="chapters")


class Episode(Base):
    """Episode model - generated podcast episode."""

    __tablename__ = "episodes"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    podcaster_id = Column(String, ForeignKey("podcasters.id"), nullable=False)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)

    # Core content
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Content configuration
    content_coverage = Column(String, nullable=False)  # ENTIRE_BOOK, MULTIPLE_CHAPTERS, SINGLE_CHAPTER
    chapters = Column(ARRAY(Integer), default=[])
    episode_type = Column(String, nullable=False)  # MONOLOGUE, DUO, GROUP
    episode_theme = Column(String, nullable=False)  # LECTURE, DISCUSSION, DEBATE
    target_length_min = Column(Integer, nullable=False)
    target_length_max = Column(Integer, nullable=False)

    # Generated content
    script_content = Column(Text, nullable=True)
    audio_file_key = Column(String, nullable=True)

    # Generation status
    generation_status = Column(String, default="PENDING")
    script_generated_at = Column(DateTime, nullable=True)
    audio_generated_at = Column(DateTime, nullable=True)
    generation_error = Column(Text, nullable=True)

    # Audio properties
    duration = Column(Integer, nullable=True)  # seconds
    audio_format = Column(String, nullable=True)

    # Metadata
    is_public = Column(Boolean, default=False)
    play_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    share_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    podcaster = relationship("Podcaster", back_populates="episodes")
    book = relationship("Book", back_populates="episodes")
