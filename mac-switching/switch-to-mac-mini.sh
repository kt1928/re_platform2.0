#!/bin/bash

# Switch to Mac Mini PostgreSQL database
# This script configures the environment to use Mac Mini PostgreSQL

set -e

# Load environment variables
source ../.env

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="../logs/switch_mac_mini_${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p ../logs

echo "🔄 Switching to Mac Mini PostgreSQL database..." | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"

# Test Mac Mini connectivity
echo "🔍 Testing Mac Mini connectivity..." | tee -a "$LOG_FILE"
if ! ssh -o ConnectTimeout=5 "${MAC_MINI_USER}@${MAC_MINI_IP}" "echo 'Connection successful'"; then
    echo "❌ Cannot connect to Mac Mini at ${MAC_MINI_IP}" | tee -a "$LOG_FILE"
    echo "💡 Make sure you're on the same network and Mac Mini is running." | tee -a "$LOG_FILE"
    exit 1
fi

# Check if PostgreSQL is running on Mac Mini via network connection
echo "🔍 Checking PostgreSQL on Mac Mini..." | tee -a "$LOG_FILE"
if ! timeout 5 bash -c "cat < /dev/null > /dev/tcp/${MAC_MINI_IP}/5432" 2>/dev/null; then
    echo "⚠️  PostgreSQL is not accepting connections on Mac Mini. Starting it..." | tee -a "$LOG_FILE"
    ssh "${MAC_MINI_USER}@${MAC_MINI_IP}" "source ~/.zprofile; cd ~/re_platform_2.0 && (docker compose up -d postgres || docker-compose up -d postgres)"
    
    # Wait for it to start
    echo "⏳ Waiting for PostgreSQL to start on Mac Mini..." | tee -a "$LOG_FILE"
    sleep 10
    
    # Test again
    if ! timeout 5 bash -c "cat < /dev/null > /dev/tcp/${MAC_MINI_IP}/5432" 2>/dev/null; then
        echo "❌ PostgreSQL still not accepting connections on Mac Mini" | tee -a "$LOG_FILE"
        exit 1
    fi
fi

# Test database connection on Mac Mini
echo "🔍 Testing database connection on Mac Mini..." | tee -a "$LOG_FILE"
if command -v psql >/dev/null 2>&1; then
    if ! psql "postgresql://re_platform_user:secure_re_platform_password_2024@${MAC_MINI_IP}:5432/re_platform" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "❌ Database connection failed on Mac Mini" | tee -a "$LOG_FILE"
        exit 1
    fi
else
    echo "ℹ️  psql not available, skipping database connection test" | tee -a "$LOG_FILE"
fi

# Stop local PostgreSQL container to avoid conflicts
echo "🛑 Stopping local PostgreSQL container..." | tee -a "$LOG_FILE"
(cd ../docker && docker compose stop postgres || docker-compose stop postgres)

# Update .env file to use Mac Mini database
echo "🔧 Updating .env file for Mac Mini database..." | tee -a "$LOG_FILE"
sed -i.bak "s/DATABASE_URL=.*/DATABASE_URL=postgresql:\/\/re_platform_user:secure_re_platform_password_2024@${MAC_MINI_IP}:5432\/re_platform/" ../.env

# Test connection from local machine
echo "🔍 Testing database connection from local machine..." | tee -a "$LOG_FILE"
if command -v psql >/dev/null 2>&1; then
    if psql "postgresql://re_platform_user:secure_re_platform_password_2024@${MAC_MINI_IP}:5432/re_platform" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database connection successful!" | tee -a "$LOG_FILE"
    else
        echo "❌ Database connection failed!" | tee -a "$LOG_FILE"
        exit 1
    fi
else
    echo "⚠️  psql not found, skipping connection test" | tee -a "$LOG_FILE"
fi

echo "🎉 Successfully switched to Mac Mini PostgreSQL database at $(date)" | tee -a "$LOG_FILE"
echo "📋 Log file: $LOG_FILE"
echo ""
echo "🔗 Database URL: postgresql://re_platform_user:***@${MAC_MINI_IP}:5432/re_platform"
echo "🌐 PgAdmin URL: http://${MAC_MINI_IP}:5050"
echo "   Email: admin@re-platform.com"
echo "   Password: Check .env file"