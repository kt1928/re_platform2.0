# RE Platform Database Management

## Overview

This document outlines the database management system for the RE Platform, featuring Docker PostgreSQL with seamless switching between local MacBook and Mac Mini deployments.

## Architecture

```
MacBook (Local Development)        Mac Mini (Home Server)
├── Docker PostgreSQL             ├── Docker PostgreSQL
├── PgAdmin (localhost:5050)       ├── PgAdmin (192.168.50.209:5050)
└── Rsync Sync ←──────────────────→ └── Rsync Sync
```

## Quick Start

### 1. Initial Setup

```bash
# Clone and setup
git clone <repo>
cd re_platform_2.0

# Start local database
docker-compose up -d postgres

# Check status
./scripts/db-status.sh
```

### 2. Database Switching

```bash
# Switch to local database
./scripts/switch-to-local.sh

# Switch to Mac Mini database
./scripts/switch-to-mac-mini.sh

# Check current status
./scripts/db-status.sh
```

### 3. Data Synchronization

```bash
# Sync data TO Mac Mini
./scripts/sync-to-mac-mini.sh

# Sync data FROM Mac Mini
./scripts/sync-from-mac-mini.sh
```

## Configuration

### Environment Variables (.env)

```bash
# Database Configuration
POSTGRES_PASSWORD=secure_re_platform_password_2024
PGADMIN_PASSWORD=admin_re_platform_2024
DATABASE_URL=postgresql://re_platform_user:secure_re_platform_password_2024@localhost:5432/re_platform

# Network Configuration
MAC_MINI_IP=192.168.50.209
MAC_MINI_USER=kappy
MAC_MINI_DB_PATH=/Users/kappy/re_platform_docker_data

# Rsync Configuration
RSYNC_OPTIONS=-avz --delete --exclude='.DS_Store'
```

### Docker Compose Services

- **postgres**: PostgreSQL 15 with persistent volumes
- **pgadmin**: Web-based database administration interface

## Management Scripts

### Core Scripts

| Script | Purpose |
|--------|---------|
| `db-status.sh` | Comprehensive database status report |
| `switch-to-local.sh` | Switch to local MacBook database |
| `switch-to-mac-mini.sh` | Switch to Mac Mini database |
| `sync-to-mac-mini.sh` | Sync local data to Mac Mini |
| `sync-from-mac-mini.sh` | Sync data from Mac Mini to local |

### Backup & Restore

| Script | Purpose |
|--------|---------|
| `backup-database.sh` | Create database backup |
| `restore-database.sh <backup_file>` | Restore from backup |

### Usage Examples

```bash
# Check system status
./scripts/db-status.sh

# Create backup
./scripts/backup-database.sh

# Restore from backup
./scripts/restore-database.sh db_backups/local_backup_20240101_120000.sql

# Work remotely
./scripts/sync-from-mac-mini.sh
./scripts/switch-to-local.sh

# Sync back when home
./scripts/sync-to-mac-mini.sh
./scripts/switch-to-mac-mini.sh
```

## Database Access

### Connection URLs

- **Local**: `postgresql://re_platform_user:***@localhost:5432/re_platform`
- **Mac Mini**: `postgresql://re_platform_user:***@192.168.50.209:5432/re_platform`

### Web Interfaces

- **Local PgAdmin**: http://localhost:5050
- **Mac Mini PgAdmin**: http://192.168.50.209:5050
  - Email: admin@re-platform.com
  - Password: See .env file

## Troubleshooting

### Common Issues

1. **Docker not running**
   ```bash
   # Start Docker Desktop
   open /Applications/Docker.app
   ```

2. **Mac Mini unreachable**
   ```bash
   # Check network connectivity
   ping 192.168.50.209
   ssh kappy@192.168.50.209
   ```

3. **Permission denied on sync**
   ```bash
   # Scripts use sudo for Docker volume access
   # Make sure you can run sudo commands
   ```

4. **Database connection failed**
   ```bash
   # Check container status
   docker-compose ps
   
   # Check logs
   docker-compose logs postgres
   ```

### Recovery Procedures

1. **Reset local database**
   ```bash
   docker-compose down
   docker volume rm re_platform_2.0_postgres_data
   docker-compose up -d postgres
   ```

2. **Emergency backup**
   ```bash
   ./scripts/backup-database.sh
   ```

3. **Force sync from Mac Mini**
   ```bash
   ./scripts/sync-from-mac-mini.sh
   ```

## Network Requirements

### Home Network Setup

- **Mac Mini**: 192.168.50.209 (static IP recommended)
- **MacBook**: Dynamic IP on same network
- **Ports**: 5432 (PostgreSQL), 5050 (PgAdmin)

### SSH Configuration

Ensure SSH key-based authentication is set up:

```bash
# Generate SSH key if needed
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Copy to Mac Mini
ssh-copy-id kappy@192.168.50.209
```

## Security Considerations

### Database Security

- Strong passwords in .env file
- Network access limited to home network
- Regular automated backups
- Audit logging enabled

### SSH Security

- Key-based authentication only
- Regular key rotation
- Network access controls

## Maintenance

### Regular Tasks

1. **Weekly backups**
   ```bash
   ./scripts/backup-database.sh
   ```

2. **Monthly cleanup**
   ```bash
   # Clean old backups (automatic)
   # Clean old logs
   find logs -name "*.log" -mtime +30 -delete
   ```

3. **Quarterly updates**
   ```bash
   # Update Docker images
   docker-compose pull
   docker-compose up -d
   ```

## Monitoring

### Log Files

All operations are logged in the `logs/` directory:

- `sync_*.log` - Synchronization operations
- `backup_*.log` - Backup operations
- `restore_*.log` - Restore operations
- `switch_*.log` - Database switching operations

### Health Checks

- PostgreSQL health check in docker-compose
- Connection tests in all scripts
- Status monitoring via db-status.sh

## Future Enhancements

1. **Automated sync scheduling** (cron jobs)
2. **Database monitoring dashboard**
3. **Multi-environment support** (dev/staging/prod)
4. **Encrypted backups** (GPG encryption)
5. **Cloud backup integration** (AWS S3, Google Cloud)

## Support

For issues or questions, check:

1. Log files in `logs/` directory
2. Docker logs: `docker-compose logs`
3. Script output and error messages
4. Network connectivity: `ping` and `ssh` tests