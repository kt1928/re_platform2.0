"""
Test configuration and fixtures for RE Platform tests.
"""

import asyncio
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db


# Test database URL - uses a separate test database
TEST_DATABASE_URL = "postgresql+asyncpg://re_platform_user:secure_password_change_me@localhost:5432/re_platform_test"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,  # Set to True for SQL debugging
    future=True
)

# Create test session factory
TestAsyncSessionLocal = sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


# Remove custom event_loop fixture to avoid pytest-asyncio conflicts


@pytest_asyncio.fixture(scope="session")
async def setup_test_db():
    """Setup and teardown test database."""
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Drop all tables after tests
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(setup_test_db) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with dependency overrides."""
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        app=app,
        base_url="http://test"
    ) as test_client:
        yield test_client
    
    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user_data():
    """Sample admin user data for testing."""
    return {
        "username": "testadmin",
        "email": "admin@test.com",
        "password": "adminpass123",
        "full_name": "Test Admin",
        "role": "ADMIN",
        "is_active": True
    }


@pytest.fixture
def regular_user_data():
    """Sample regular user data for testing."""
    return {
        "username": "testuser",
        "email": "user@test.com", 
        "password": "userpass123",
        "full_name": "Test User",
        "role": "VIEWER",
        "is_active": True
    }