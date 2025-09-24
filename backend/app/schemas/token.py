"""
Pydantic schemas for JWT token operations.
"""

from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    """Token response schema."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """Token data for validation."""
    username: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None