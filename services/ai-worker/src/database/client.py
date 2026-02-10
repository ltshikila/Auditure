"""Database client using SQLAlchemy."""

import logging
from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.config import get_settings

logger = logging.getLogger(__name__)


class DatabaseClient:
    """PostgreSQL database client using SQLAlchemy."""

    def __init__(self, database_url: str):
        """Initialize database connection."""
        self.engine = create_engine(
            database_url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,  # Verify connections before using
            echo=False,
        )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )
        logger.info("Database client initialized")

    def get_session(self) -> Generator[Session, None, None]:
        """Get a database session (context manager)."""
        session = self.SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def create_session(self) -> Session:
        """Create a new database session."""
        return self.SessionLocal()

    def close(self) -> None:
        """Close all database connections."""
        self.engine.dispose()
        logger.info("Database connections closed")


@lru_cache
def get_database_client() -> DatabaseClient:
    """Get cached database client instance."""
    settings = get_settings()
    return DatabaseClient(settings.database_url)
