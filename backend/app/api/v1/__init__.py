"""
API v1 router configuration.
"""

from fastapi import APIRouter
from app.api.v1 import auth

api_router = APIRouter()

# Basic status endpoint
@api_router.get("/status")
async def api_status():
    """API status endpoint."""
    return {"message": "RE Platform API v1 is running"}


# Include authentication routes
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])

# Import and include other routers here when they exist
# from app.api.v1 import users
# api_router.include_router(users.router, prefix="/users", tags=["users"])