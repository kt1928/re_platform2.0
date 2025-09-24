"""
Tests for authentication system.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.main import app
from app.models.user import User, UserRole
from app.services.auth_service import AuthService
from app.core.security import verify_password, get_password_hash


class TestAuthService:
    """Test authentication service functionality."""
    
    @pytest.mark.asyncio
    async def test_create_user(self, db_session: AsyncSession):
        """Test user creation."""
        from app.schemas.user import UserCreate
        
        user_data = UserCreate(
            username="testuser",
            email="test@example.com", 
            password="testpass123",
            full_name="Test User",
            role=UserRole.ANALYST
        )
        
        user = await AuthService.create_user(db_session, user_data)
        
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"
        assert user.role == UserRole.ANALYST
        assert user.is_active is True
        assert verify_password("testpass123", user.hashed_password)
    
    @pytest.mark.asyncio
    async def test_authenticate_user_success(self, db_session: AsyncSession):
        """Test successful user authentication."""
        from app.schemas.user import UserLogin
        
        # Create a test user first
        hashed_password = get_password_hash("testpass123")
        user = User(
            username="authtest",
            email="authtest@example.com",
            hashed_password=hashed_password,
            role=UserRole.VIEWER,
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        
        login_data = UserLogin(username="authtest", password="testpass123")
        authenticated_user = await AuthService.authenticate_user(db_session, login_data)
        
        assert authenticated_user is not None
        assert authenticated_user.username == "authtest"
    
    @pytest.mark.asyncio
    async def test_authenticate_user_wrong_password(self, db_session: AsyncSession):
        """Test authentication with wrong password."""
        from app.schemas.user import UserLogin
        
        # Create a test user first
        hashed_password = get_password_hash("correctpass")
        user = User(
            username="wrongpasstest",
            email="wrongpass@example.com",
            hashed_password=hashed_password,
            role=UserRole.VIEWER,
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        
        login_data = UserLogin(username="wrongpasstest", password="wrongpass")
        authenticated_user = await AuthService.authenticate_user(db_session, login_data)
        
        assert authenticated_user is None
    
    @pytest.mark.asyncio
    async def test_authenticate_nonexistent_user(self, db_session: AsyncSession):
        """Test authentication of nonexistent user."""
        from app.schemas.user import UserLogin
        
        login_data = UserLogin(username="nonexistent", password="anypass")
        authenticated_user = await AuthService.authenticate_user(db_session, login_data)
        
        assert authenticated_user is None


class TestAuthAPI:
    """Test authentication API endpoints."""
    
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, db_session: AsyncSession):
        """Test successful login API call."""
        # Create a test user first
        hashed_password = get_password_hash("testpass123")
        user = User(
            username="apitest",
            email="apitest@example.com",
            hashed_password=hashed_password,
            role=UserRole.ANALYST,
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        
        # Attempt login
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "apitest", "password": "testpass123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
    
    @pytest.mark.asyncio
    async def test_login_wrong_credentials(self, client: AsyncClient):
        """Test login with wrong credentials."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "nonexistent", "password": "wrongpass"}
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    @pytest.mark.asyncio
    async def test_get_current_user_without_token(self, client: AsyncClient):
        """Test accessing protected endpoint without token."""
        response = await client.get("/api/v1/auth/me")
        
        assert response.status_code == 403
    
    @pytest.mark.asyncio 
    async def test_get_current_user_with_token(self, client: AsyncClient, db_session: AsyncSession):
        """Test accessing protected endpoint with valid token."""
        # Create a test user
        hashed_password = get_password_hash("testpass123") 
        user = User(
            username="tokentest",
            email="tokentest@example.com",
            hashed_password=hashed_password,
            role=UserRole.ADMIN,
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        
        # Login to get token
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"username": "tokentest", "password": "testpass123"}
        )
        
        assert login_response.status_code == 200
        token_data = login_response.json()
        access_token = token_data["access_token"]
        
        # Use token to access protected endpoint
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert response.status_code == 200
        user_data = response.json()
        assert user_data["username"] == "tokentest"
        assert user_data["email"] == "tokentest@example.com"
        assert user_data["role"] == "ADMIN"