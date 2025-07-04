#!/bin/bash

# Sync Docker PostgreSQL data to Mac Mini
# This script synchronizes the local Docker volume data to the Mac Mini

set -e

# Load environment variables
source .env

# Configuration
LOCAL_DOCKER_VOLUME="re_platform_2.0_postgres_data"
MAC_MINI_TARGET="${MAC_MINI_USER}@${MAC_MINI_IP}:${MAC_MINI_DB_PATH}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/sync_${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p logs

echo "🔄 Starting sync to Mac Mini..." | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first." | tee -a "$LOG_FILE"
    exit 1
fi

# Check if PostgreSQL container exists
if ! docker ps -a --format 'table {{.Names}}' | grep -q "re_platform_postgres"; then
    echo "❌ PostgreSQL container not found. Please run docker-compose up first." | tee -a "$LOG_FILE"
    exit 1
fi

# Stop PostgreSQL container to ensure data consistency
echo "🛑 Stopping PostgreSQL container..." | tee -a "$LOG_FILE"
docker compose stop postgres || docker-compose stop postgres

# Get the Docker volume path
VOLUME_PATH=$(docker volume inspect ${LOCAL_DOCKER_VOLUME} --format '{{ .Mountpoint }}')

if [ -z "$VOLUME_PATH" ]; then
    echo "❌ Could not find Docker volume path for ${LOCAL_DOCKER_VOLUME}" | tee -a "$LOG_FILE"
    exit 1
fi

echo "📂 Local volume path: $VOLUME_PATH" | tee -a "$LOG_FILE"

# Test Mac Mini connectivity
echo "🔍 Testing Mac Mini connectivity..." | tee -a "$LOG_FILE"
if ! ssh -o ConnectTimeout=5 "${MAC_MINI_USER}@${MAC_MINI_IP}" "echo 'Connection successful'"; then
    echo "❌ Cannot connect to Mac Mini at ${MAC_MINI_IP}" | tee -a "$LOG_FILE"
    echo "🚀 Restarting PostgreSQL container..." | tee -a "$LOG_FILE"
    docker-compose start postgres
    exit 1
fi

# Create target directory on Mac Mini
echo "📁 Creating target directory on Mac Mini..." | tee -a "$LOG_FILE"
ssh "${MAC_MINI_USER}@${MAC_MINI_IP}" "mkdir -p ${MAC_MINI_DB_PATH}"

# Perform rsync with progress
echo "🔄 Syncing data to Mac Mini..." | tee -a "$LOG_FILE"
echo "Source: $VOLUME_PATH" | tee -a "$LOG_FILE"
echo "Target: $MAC_MINI_TARGET" | tee -a "$LOG_FILE"

# Note: We need to use sudo to access Docker volume data
sudo rsync $RSYNC_OPTIONS \
    --progress \
    --stats \
    "$VOLUME_PATH/" \
    "$MAC_MINI_TARGET/" 2>&1 | tee -a "$LOG_FILE"

# Check rsync exit status
if [ $? -eq 0 ]; then
    echo "✅ Sync completed successfully!" | tee -a "$LOG_FILE"
else
    echo "❌ Sync failed!" | tee -a "$LOG_FILE"
    exit 1
fi

# Restart PostgreSQL container
echo "🚀 Restarting PostgreSQL container..." | tee -a "$LOG_FILE"
docker compose start postgres || docker-compose start postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..." | tee -a "$LOG_FILE"
sleep 5

# Test database connection
if docker compose exec postgres pg_isready -U re_platform_user -d re_platform >/dev/null 2>&1 || docker-compose exec postgres pg_isready -U re_platform_user -d re_platform >/dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!" | tee -a "$LOG_FILE"
else
    echo "⚠️  PostgreSQL may not be fully ready yet." | tee -a "$LOG_FILE"
fi

echo "🎉 Sync to Mac Mini completed at $(date)" | tee -a "$LOG_FILE"
echo "📋 Log file: $LOG_FILE"