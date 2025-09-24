"""
Seed script to create an initial admin user for the RE Platform.
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash


async def create_admin_user() -> None:
    """Create the initial admin user."""
    
    # Admin user details
    admin_data = {
        "username": "admin",
        "email": "admin@re-platform.local", 
        "password": "admin123!",  # Change this in production!
        "full_name": "System Administrator",
        "role": UserRole.ADMIN,
        "is_active": True,
        "is_verified": True
    }
    
    async with AsyncSessionLocal() as db:
        try:
            # Check if admin user already exists
            result = await db.execute(
                select(User).where(User.username == admin_data["username"])
            )
            existing_user = result.scalars().first()
            
            if existing_user:
                print(f"Admin user '{admin_data['username']}' already exists.")
                return
            
            # Create new admin user
            hashed_password = get_password_hash(admin_data["password"])
            
            admin_user = User(
                username=admin_data["username"],
                email=admin_data["email"],
                hashed_password=hashed_password,
                full_name=admin_data["full_name"],
                role=admin_data["role"],
                is_active=admin_data["is_active"],
                is_verified=admin_data["is_verified"]
            )
            
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            
            print(f"✅ Created admin user: {admin_user.username}")
            print(f"   Email: {admin_user.email}")
            print(f"   Role: {admin_user.role.value}")
            print(f"   ID: {admin_user.id}")
            print("\n🚨 IMPORTANT: Change the default password in production!")
            print(f"   Default password: {admin_data['password']}")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Error creating admin user: {e}")
            raise


async def main():
    """Main function to run the seed script."""
    print("🌱 Creating initial admin user...")
    await create_admin_user()
    print("✅ Seeding complete!")


if __name__ == "__main__":
    asyncio.run(main())