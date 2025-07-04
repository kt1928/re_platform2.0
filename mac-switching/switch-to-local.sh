#!/bin/bash

# Switch to local PostgreSQL database
# This script configures the environment to use local Docker PostgreSQL

set -e

# Load environment variables
source ../.env

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="../logs/switch_local_${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p ../logs

echo "🔄 Switching to local PostgreSQL database..." | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first." | tee -a "$LOG_FILE"
    exit 1
fi

# Start PostgreSQL container if not running
if ! (cd ../docker && docker compose ps postgres || docker-compose ps postgres) | grep -q "Up"; then
    echo "🚀 Starting PostgreSQL container..." | tee -a "$LOG_FILE"
    (cd ../docker && docker compose up -d postgres || docker-compose up -d postgres)
else
    echo "✅ PostgreSQL container is already running." | tee -a "$LOG_FILE"
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..." | tee -a "$LOG_FILE"
sleep 5

# Test database connection
MAX_ATTEMPTS=30
ATTEMPTS=0

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    if (cd ../docker && docker compose exec postgres pg_isready -U re_platform_user -d re_platform) >/dev/null 2>&1 || (cd ../docker && docker-compose exec postgres pg_isready -U re_platform_user -d re_platform) >/dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!" | tee -a "$LOG_FILE"
        break
    fi
    
    ATTEMPTS=$((ATTEMPTS + 1))
    echo "⏳ Attempt $ATTEMPTS/$MAX_ATTEMPTS - waiting for PostgreSQL..." | tee -a "$LOG_FILE"
    sleep 2
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
    echo "❌ PostgreSQL failed to start after $MAX_ATTEMPTS attempts" | tee -a "$LOG_FILE"
    exit 1
fi

# Update .env file to use local database
echo "🔧 Updating .env file for local database..." | tee -a "$LOG_FILE"
sed -i.bak 's/DATABASE_URL=.*/DATABASE_URL=postgresql:\/\/re_platform_user:secure_re_platform_password_2024@localhost:5432\/re_platform/' ../.env

# Show database status
echo "📊 Database Status:" | tee -a "$LOG_FILE"
(cd ../docker && docker compose ps postgres || docker-compose ps postgres) | tee -a "$LOG_FILE"

echo "🎉 Successfully switched to local PostgreSQL database at $(date)" | tee -a "$LOG_FILE"
echo "📋 Log file: $LOG_FILE"
echo ""
echo "🔗 Database URL: postgresql://re_platform_user:***@localhost:5432/re_platform"
echo "🌐 PgAdmin URL: http://localhost:5050"
echo "   Email: admin@re-platform.com"
echo "   Password: Check .env file"