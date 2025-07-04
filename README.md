# RE Platform 2.0 - Fresh Python Build

## Project Structure

```
re_platform_2.0/
├── .env                    # Environment configuration
├── DATABASE_MANAGEMENT.md  # Detailed database documentation
├── CLAUDE.md              # AI assistant instructions
├── docker/                # Docker and database management
│   ├── docker-compose.yml # PostgreSQL and PgAdmin services
│   ├── postgres-init/     # Database initialization scripts
│   ├── backup-database.sh # Database backup utility
│   └── restore-database.sh # Database restore utility
├── mac-switching/         # Mac Mini ↔ MacBook switching
│   ├── db-status.sh       # Database status and connectivity
│   ├── switch-to-local.sh # Switch to MacBook database
│   ├── switch-to-mac-mini.sh # Switch to Mac Mini database
│   ├── sync-to-mac-mini.sh   # Sync data TO Mac Mini
│   └── sync-from-mac-mini.sh # Sync data FROM Mac Mini
├── db_backups/           # Database backup files
└── logs/                 # Operation logs
```

## Quick Start

### 1. Start Local Database
```bash
cd docker
docker compose up -d postgres
```

### 2. Check Status
```bash
./mac-switching/db-status.sh
```

### 3. Switch Between Databases
```bash
# Switch to local
./mac-switching/switch-to-local.sh

# Switch to Mac Mini
./mac-switching/switch-to-mac-mini.sh
```

### 4. Sync Data
```bash
# Sync TO Mac Mini
./mac-switching/sync-to-mac-mini.sh

# Sync FROM Mac Mini
./mac-switching/sync-from-mac-mini.sh
```

## Key Features

- **Docker PostgreSQL** with persistent volumes
- **PgAdmin** web interface on port 5050
- **Seamless switching** between MacBook and Mac Mini
- **Rsync data synchronization** with automated scripts
- **Network-based connectivity testing** (no SSH Docker dependencies)
- **Comprehensive logging** of all operations
- **Automated backup/restore** procedures

## Web Interfaces

- **Local PgAdmin**: http://localhost:5050
- **Mac Mini PgAdmin**: http://192.168.50.209:5050
  - Email: admin@re-platform.com
  - Password: See .env file

## Configuration

All configuration is in `.env` file:
- Database passwords
- Mac Mini network settings
- Rsync options
- Connection strings

## Phase 1 Complete ✅

The Docker PostgreSQL infrastructure with Mac Mini mirroring is now complete and organized into logical directories. Ready for Phase 2: Python Foundation & Authentication.