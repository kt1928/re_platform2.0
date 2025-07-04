#!/bin/bash

# Sync Docker PostgreSQL data from Mac Mini
# This script synchronizes the Mac Mini Docker volume data to local machine

set -e

# Load environment variables
source .env

# Configuration
LOCAL_DOCKER_VOLUME="re_platform_2.0_postgres_data"
MAC_MINI_SOURCE="${MAC_MINI_USER}@${MAC_MINI_IP}:${MAC_MINI_DB_PATH}/"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/sync_from_${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p logs

echo "🔄 Starting sync from Mac Mini..." | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first." | tee -a "$LOG_FILE"
    exit 1
fi

# Test Mac Mini connectivity
echo "🔍 Testing Mac Mini connectivity..." | tee -a "$LOG_FILE"
if ! ssh -o ConnectTimeout=5 "${MAC_MINI_USER}@${MAC_MINI_IP}" "echo 'Connection successful'"; then
    echo "❌ Cannot connect to Mac Mini at ${MAC_MINI_IP}" | tee -a "$LOG_FILE"
    exit 1
fi

# Check if source directory exists on Mac Mini
echo "📁 Checking source directory on Mac Mini..." | tee -a "$LOG_FILE"
if ! ssh "${MAC_MINI_USER}@${MAC_MINI_IP}" "test -d ${MAC_MINI_DB_PATH}"; then
    echo "❌ Source directory ${MAC_MINI_DB_PATH} does not exist on Mac Mini" | tee -a "$LOG_FILE"
    exit 1
fi

# Stop PostgreSQL container to ensure data consistency
echo "🛑 Stopping PostgreSQL container..." | tee -a "$LOG_FILE"
docker-compose stop postgres

# Remove existing Docker volume if it exists
if docker volume ls | grep -q "${LOCAL_DOCKER_VOLUME}"; then
    echo "🗑️  Removing existing Docker volume..." | tee -a "$LOG_FILE"
    docker volume rm "${LOCAL_DOCKER_VOLUME}"
fi

# Create new Docker volume
echo "📦 Creating new Docker volume..." | tee -a "$LOG_FILE"
docker volume create "${LOCAL_DOCKER_VOLUME}"

# Get the Docker volume path
VOLUME_PATH=$(docker volume inspect ${LOCAL_DOCKER_VOLUME} --format '{{ .Mountpoint }}')

if [ -z "$VOLUME_PATH" ]; then
    echo "❌ Could not find Docker volume path for ${LOCAL_DOCKER_VOLUME}" | tee -a "$LOG_FILE"
    exit 1
fi

echo "📂 Local volume path: $VOLUME_PATH" | tee -a "$LOG_FILE"

# Perform rsync with progress
echo "🔄 Syncing data from Mac Mini..." | tee -a "$LOG_FILE"
echo "Source: $MAC_MINI_SOURCE" | tee -a "$LOG_FILE"
echo "Target: $VOLUME_PATH" | tee -a "$LOG_FILE"

# Note: We need to use sudo to write to Docker volume
sudo rsync $RSYNC_OPTIONS \
    --progress \
    --stats \
    "$MAC_MINI_SOURCE" \
    "$VOLUME_PATH/" 2>&1 | tee -a "$LOG_FILE"

# Check rsync exit status
if [ $? -eq 0 ]; then
    echo "✅ Sync completed successfully!" | tee -a "$LOG_FILE"
else
    echo "❌ Sync failed!" | tee -a "$LOG_FILE"
    exit 1
fi

# Fix permissions on the volume
echo "🔧 Fixing permissions..." | tee -a "$LOG_FILE"
sudo chown -R 999:999 "$VOLUME_PATH"

# Start PostgreSQL container
echo "🚀 Starting PostgreSQL container..." | tee -a "$LOG_FILE"
docker-compose start postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..." | tee -a "$LOG_FILE"
sleep 10

# Test database connection
if docker-compose exec postgres pg_isready -U re_platform_user -d re_platform >/dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!" | tee -a "$LOG_FILE"
else
    echo "⚠️  PostgreSQL may not be fully ready yet." | tee -a "$LOG_FILE"
fi

echo "🎉 Sync from Mac Mini completed at $(date)" | tee -a "$LOG_FILE"
echo "📋 Log file: $LOG_FILE"