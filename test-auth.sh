#!/bin/bash

# Real Estate Platform - Authentication Testing Script
# Run this after setting up your database

BASE_URL="http://localhost:3000/api/v1"

echo "🏠 Real Estate Platform - Authentication Test"
echo "============================================="
echo ""

# Test health check first
echo "1. Testing health check..."
HEALTH=$(curl -s "$BASE_URL/../health")
echo "Response: $HEALTH"
echo ""

# Test login
echo "2. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@re-platform.com",
    "password": "AdminPass123!"
  }')

echo "Login Response: $LOGIN_RESPONSE"
echo ""

# Extract token (requires jq)
if command -v jq &> /dev/null; then
  TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token // empty')
  
  if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "3. Testing authenticated endpoint..."
    ME_RESPONSE=$(curl -s "$BASE_URL/auth/me" \
      -H "Authorization: Bearer $TOKEN")
    echo "Me Response: $ME_RESPONSE"
    echo ""
    
    echo "4. Testing user registration (admin only)..."
    REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "email": "analyst@re-platform.com",
        "password": "AnalystPass123!",
        "fullName": "Test Analyst",
        "role": "ANALYST"
      }')
    echo "Register Response: $REGISTER_RESPONSE"
    echo ""
    
    echo "✅ Authentication tests complete!"
  else
    echo "❌ Failed to get token from login response"
  fi
else
  echo "⚠️  Install 'jq' to automatically test authenticated endpoints"
  echo "Token will be in the login response above"
fi