#!/bin/bash

# Restore PostgreSQL database from backup
# This script restores a PostgreSQL database from a backup file

set -e

# Load environment variables
source .env

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/restore_${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p logs

echo "🔄 Database Restore Utility" | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "❌ No backup file specified" | tee -a "$LOG_FILE"
    echo ""
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -la db_backups/*.sql 2>/dev/null || echo "No backup files found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE" | tee -a "$LOG_FILE"
    exit 1
fi

echo "📁 Restoring from: $BACKUP_FILE" | tee -a "$LOG_FILE"

# Handle compressed files
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "📦 Extracting compressed backup..." | tee -a "$LOG_FILE"
    TEMP_FILE="temp_restore_${TIMESTAMP}.sql"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    BACKUP_FILE="$TEMP_FILE"
    CLEANUP_TEMP=true
else
    CLEANUP_TEMP=false
fi

# Determine restore strategy based on current DATABASE_URL
if [[ "$DATABASE_URL" == *"localhost"* ]]; then
    echo "📍 Restoring to LOCAL database" | tee -a "$LOG_FILE"
    
    # Check if local container is running
    if ! docker-compose ps postgres | grep -q "Up"; then
        echo "❌ Local PostgreSQL container is not running" | tee -a "$LOG_FILE"
        echo "🚀 Starting PostgreSQL container..." | tee -a "$LOG_FILE"
        docker-compose up -d postgres
        sleep 10
    fi
    
    # Confirm restore
    echo "⚠️  WARNING: This will COMPLETELY REPLACE the current database!"
    echo "Current database: LOCAL (localhost)"
    echo "Backup file: $BACKUP_FILE"
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "❌ Restore cancelled" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # Drop and recreate database
    echo "🗑️  Dropping existing database..." | tee -a "$LOG_FILE"
    docker-compose exec postgres psql -U re_platform_user -d postgres -c "DROP DATABASE IF EXISTS re_platform;"
    
    echo "🏗️  Creating new database..." | tee -a "$LOG_FILE"
    docker-compose exec postgres psql -U re_platform_user -d postgres -c "CREATE DATABASE re_platform;"
    
    # Restore from backup
    echo "📥 Restoring database from backup..." | tee -a "$LOG_FILE"
    docker-compose exec -T postgres psql -U re_platform_user -d re_platform < "$BACKUP_FILE"
    
    echo "✅ Local database restored successfully" | tee -a "$LOG_FILE"
    
else
    echo "📍 Restoring to MAC MINI database" | tee -a "$LOG_FILE"
    
    # Test Mac Mini connectivity
    if ! ssh -o ConnectTimeout=5 "${MAC_MINI_USER}@${MAC_MINI_IP}" "echo 'Connection successful'" >/dev/null 2>&1; then
        echo "❌ Cannot connect to Mac Mini at ${MAC_MINI_IP}" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # Confirm restore
    echo "⚠️  WARNING: This will COMPLETELY REPLACE the current database!"
    echo "Current database: MAC MINI (${MAC_MINI_IP})"
    echo "Backup file: $BACKUP_FILE"
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "❌ Restore cancelled" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # Copy backup file to Mac Mini
    echo "📤 Copying backup file to Mac Mini..." | tee -a "$LOG_FILE"
    scp "$BACKUP_FILE" "${MAC_MINI_USER}@${MAC_MINI_IP}:~/temp_restore.sql"
    
    # Drop and recreate database on Mac Mini
    echo "🗑️  Dropping existing database on Mac Mini..." | tee -a "$LOG_FILE"
    ssh "${MAC_MINI_USER}@${MAC_MINI_IP}" "docker-compose -f ~/re_platform_2.0/docker-compose.yml exec postgres psql -U re_platform_user -d postgres -c 'DROP DATABASE IF EXISTS re_platform;'"
    
    echo "🏗️  Creating new database on Mac Mini..." | tee -a "$LOG_FILE"
    ssh "${MAC_MINI_USER}@${MAC_MINI_IP}" "docker-compose -f ~/re_platform_2.0/docker-compose.yml exec postgres psql -U re_platform_user -d postgres -c 'CREATE DATABASE re_platform;'"
    
    # Restore from backup
    echo "📥 Restoring database from backup..." | tee -a "$LOG_FILE"
    ssh "${MAC_MINI_USER}@${MAC_MINI_IP}" "docker-compose -f ~/re_platform_2.0/docker-compose.yml exec -T postgres psql -U re_platform_user -d re_platform < ~/temp_restore.sql"
    
    # Clean up temporary file
    ssh "${MAC_MINI_USER}@${MAC_MINI_IP}" "rm -f ~/temp_restore.sql"
    
    echo "✅ Mac Mini database restored successfully" | tee -a "$LOG_FILE"
fi

# Clean up temporary file if needed
if [ "$CLEANUP_TEMP" = true ]; then
    echo "🧹 Cleaning up temporary files..." | tee -a "$LOG_FILE"
    rm -f "$TEMP_FILE"
fi

echo "🎉 Database restore completed successfully at $(date)" | tee -a "$LOG_FILE"
echo "📋 Log file: $LOG_FILE"