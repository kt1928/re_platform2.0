#!/bin/bash

# Backup PostgreSQL database
# This script creates a backup of the current PostgreSQL database

set -e

# Load environment variables
source .env

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="db_backups"
LOG_FILE="logs/backup_${TIMESTAMP}.log"

# Create directories if they don't exist
mkdir -p "$BACKUP_DIR"
mkdir -p logs

echo "💾 Starting database backup..." | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"

# Determine backup strategy based on current DATABASE_URL
if [[ "$DATABASE_URL" == *"localhost"* ]]; then
    echo "📍 Backing up LOCAL database" | tee -a "$LOG_FILE"
    
    # Check if local container is running
    if ! docker-compose ps postgres | grep -q "Up"; then
        echo "❌ Local PostgreSQL container is not running" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # Create backup using docker exec
    BACKUP_FILE="${BACKUP_DIR}/local_backup_${TIMESTAMP}.sql"
    echo "📁 Creating backup: $BACKUP_FILE" | tee -a "$LOG_FILE"
    
    docker-compose exec postgres pg_dump -U re_platform_user -d re_platform > "$BACKUP_FILE"
    
    # Create compressed version
    gzip -c "$BACKUP_FILE" > "${BACKUP_FILE}.gz"
    
    echo "✅ Local backup completed" | tee -a "$LOG_FILE"
    echo "📁 Backup file: $BACKUP_FILE" | tee -a "$LOG_FILE"
    echo "📁 Compressed: ${BACKUP_FILE}.gz" | tee -a "$LOG_FILE"
    
else
    echo "📍 Backing up MAC MINI database" | tee -a "$LOG_FILE"
    
    # Test Mac Mini connectivity
    if ! ssh -o ConnectTimeout=5 "${MAC_MINI_USER}@${MAC_MINI_IP}" "echo 'Connection successful'" >/dev/null 2>&1; then
        echo "❌ Cannot connect to Mac Mini at ${MAC_MINI_IP}" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # Create backup via SSH
    BACKUP_FILE="${BACKUP_DIR}/mac_mini_backup_${TIMESTAMP}.sql"
    echo "📁 Creating backup: $BACKUP_FILE" | tee -a "$LOG_FILE"
    
    ssh "${MAC_MINI_USER}@${MAC_MINI_IP}" "docker-compose -f ~/re_platform_2.0/docker-compose.yml exec postgres pg_dump -U re_platform_user -d re_platform" > "$BACKUP_FILE"
    
    # Create compressed version
    gzip -c "$BACKUP_FILE" > "${BACKUP_FILE}.gz"
    
    echo "✅ Mac Mini backup completed" | tee -a "$LOG_FILE"
    echo "📁 Backup file: $BACKUP_FILE" | tee -a "$LOG_FILE"
    echo "📁 Compressed: ${BACKUP_FILE}.gz" | tee -a "$LOG_FILE"
fi

# Show backup info
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)

echo "📊 Backup Statistics:" | tee -a "$LOG_FILE"
echo "• Original size: $BACKUP_SIZE" | tee -a "$LOG_FILE"
echo "• Compressed size: $COMPRESSED_SIZE" | tee -a "$LOG_FILE"

# Clean up old backups (keep last 10)
echo "🧹 Cleaning up old backups..." | tee -a "$LOG_FILE"
find "$BACKUP_DIR" -name "*.sql" -type f | sort -r | tail -n +11 | xargs rm -f
find "$BACKUP_DIR" -name "*.sql.gz" -type f | sort -r | tail -n +11 | xargs rm -f

echo "🎉 Backup completed successfully at $(date)" | tee -a "$LOG_FILE"
echo "📋 Log file: $LOG_FILE"