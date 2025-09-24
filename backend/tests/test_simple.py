"""
Simple tests for core functionality.
"""

import pytest
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import UserRole


class TestSecurity:
    """Test security utilities."""
    
    def test_password_hashing(self):
        """Test password hashing and verification."""
        password = "testpassword123"
        hashed = get_password_hash(password)
        
        # Password should not be stored in plain text
        assert password != hashed
        assert len(hashed) > 0
        
        # Verification should work
        assert verify_password(password, hashed) is True
        assert verify_password("wrongpassword", hashed) is False
    
    def test_jwt_token_creation(self):
        """Test JWT token creation."""
        data = {
            "sub": "testuser",
            "user_id": 1,
            "role": UserRole.ADMIN.value
        }
        
        token = create_access_token(data)
        
        assert isinstance(token, str)
        assert len(token) > 0
        # JWT tokens have 3 parts separated by dots
        assert token.count('.') == 2


class TestUserModel:
    """Test user model."""
    
    def test_user_role_enum(self):
        """Test user role enumeration."""
        assert UserRole.ADMIN.value == "admin"
        assert UserRole.ANALYST.value == "analyst" 
        assert UserRole.VIEWER.value == "viewer"
    
    def test_user_creation(self):
        """Test user model instantiation."""
        from app.models.user import User
        
        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password="hashed_password_here",
            role=UserRole.ADMIN,
            is_active=True
        )
        
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.role == UserRole.ADMIN
        assert user.is_active is True


class TestConfig:
    """Test configuration."""
    
    def test_settings_load(self):
        """Test that settings load correctly."""
        from app.core.config import settings
        
        assert settings.PROJECT_NAME == "RE Platform"
        assert settings.VERSION == "0.1.0"
        assert settings.API_V1_STR == "/api/v1"
        assert settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0