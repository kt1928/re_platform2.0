#!/bin/bash

# Check database status and connectivity
# This script provides comprehensive status information about the database setup

set -e

# Load environment variables
source ../.env

echo "🔍 RE Platform Database Status Report"
echo "===================================="
echo "Timestamp: $(date)"
echo ""

# Check current DATABASE_URL
echo "📋 Current Configuration:"
echo "DATABASE_URL: ${DATABASE_URL}"
echo "MAC_MINI_IP: ${MAC_MINI_IP}"
echo ""

# Check Docker status
echo "🐳 Docker Status:"
if docker info >/dev/null 2>&1; then
    echo "✅ Docker is running"
    
    # Check local PostgreSQL container
    echo ""
    echo "🗄️  Local PostgreSQL Container:"
    if docker ps --filter "name=re_platform_postgres" --format "table {{.Status}}" | grep -q "Up"; then
        echo "✅ Local PostgreSQL is running"
        LOCAL_STATUS="UP"
    else
        echo "❌ Local PostgreSQL is not running"
        LOCAL_STATUS="DOWN"
    fi
    
    # Show container details
    docker ps --filter "name=re_platform_postgres" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
else
    echo "❌ Docker is not running"
    LOCAL_STATUS="DOCKER_DOWN"
fi

echo ""

# Check Mac Mini connectivity
echo "🌐 Mac Mini Connectivity:"
if ssh -o ConnectTimeout=5 "${MAC_MINI_USER}@${MAC_MINI_IP}" "echo 'Connection successful'" >/dev/null 2>&1; then
    echo "✅ Mac Mini SSH is reachable at ${MAC_MINI_IP}"
    SSH_STATUS="UP"
else
    echo "⚠️  Mac Mini SSH not available at ${MAC_MINI_IP} (may be disabled)"
    SSH_STATUS="DOWN"
fi

# Check Mac Mini PostgreSQL via network connection (regardless of SSH)
echo ""
echo "🗄️  Mac Mini PostgreSQL:"
if timeout 5 bash -c "cat < /dev/null > /dev/tcp/${MAC_MINI_IP}/5432" 2>/dev/null; then
    echo "✅ Mac Mini PostgreSQL is accepting connections on port 5432"
    MAC_MINI_STATUS="UP"
    
    # Test actual database connection if psql is available
    if command -v psql >/dev/null 2>&1; then
        if psql "postgresql://re_platform_user:secure_re_platform_password_2024@${MAC_MINI_IP}:5432/re_platform" -c "SELECT 1;" >/dev/null 2>&1; then
            echo "✅ Mac Mini database connection successful"
        else
            echo "⚠️  Mac Mini port 5432 open but database connection failed"
        fi
    else
        echo "ℹ️  psql not available for database connection test"
    fi
else
    echo "❌ Mac Mini PostgreSQL is not accepting connections on port 5432"
    MAC_MINI_STATUS="DOWN"
fi

echo ""

# Test database connection based on current DATABASE_URL
echo "🔗 Database Connection Test:"
if [[ "$DATABASE_URL" == *"localhost"* ]]; then
    echo "Testing local database connection..."
    if [ "$LOCAL_STATUS" = "UP" ]; then
        if docker exec re_platform_postgres pg_isready -U re_platform_user -d re_platform >/dev/null 2>&1; then
            echo "✅ Local database connection successful"
        else
            echo "❌ Local database connection failed"
        fi
    else
        echo "❌ Local PostgreSQL is not running"
    fi
else
    echo "Testing Mac Mini database connection..."
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
            echo "✅ Mac Mini database connection successful"
        else
            echo "❌ Mac Mini database connection failed"
        fi
    else
        echo "⚠️  psql not found, cannot test connection"
    fi
fi

echo ""

# Show recommended actions
echo "💡 Recommended Actions:"
echo "======================"

if [[ "$DATABASE_URL" == *"localhost"* ]]; then
    echo "🏠 Currently configured for LOCAL database"
    if [ "$LOCAL_STATUS" = "UP" ]; then
        echo "✅ Local setup is working correctly"
    else
        echo "🚀 Run: cd docker && docker compose up -d postgres"
    fi
    
    if [ "$MAC_MINI_STATUS" = "UP" ]; then
        echo "💾 To sync to Mac Mini: ./mac-switching/sync-to-mac-mini.sh"
        echo "🔄 To switch to Mac Mini: ./mac-switching/switch-to-mac-mini.sh"
    fi
else
    echo "🌐 Currently configured for MAC MINI database"
    if [ "$MAC_MINI_STATUS" = "UP" ]; then
        echo "✅ Mac Mini setup is working correctly"
    else
        echo "🚀 Mac Mini PostgreSQL needs to be started"
    fi
    
    echo "🔄 To switch to local: ./mac-switching/switch-to-local.sh"
    echo "💾 To sync from Mac Mini: ./mac-switching/sync-from-mac-mini.sh"
fi

echo ""
echo "🌐 Web Interfaces:"
if [[ "$DATABASE_URL" == *"localhost"* ]]; then
    echo "PgAdmin: http://localhost:5050"
else
    echo "PgAdmin: http://${MAC_MINI_IP}:5050"
fi

echo ""
echo "📋 Available Scripts:"
echo "• ./mac-switching/switch-to-local.sh    - Switch to local database"
echo "• ./mac-switching/switch-to-mac-mini.sh - Switch to Mac Mini database"
echo "• ./mac-switching/sync-to-mac-mini.sh   - Sync data to Mac Mini"
echo "• ./mac-switching/sync-from-mac-mini.sh - Sync data from Mac Mini"
echo "• ./mac-switching/db-status.sh          - This status report"