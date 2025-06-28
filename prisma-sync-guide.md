# Prisma Database Sync Guide for Mac Mini

## Quick Sync (Recommended)

Since you're using `prisma db push` (no migrations), the fastest way to sync is:

### 1. On Mac Mini - Reset Database to Match Schema

```bash
# SSH into Mac Mini
ssh kappy@mac.local

# Navigate to project directory
cd ~/Downloads/re_platform

# Reset database to match schema (DESTRUCTIVE - will clear data)
npx prisma db push --force-reset

# Optionally, seed with essential data
npx prisma db seed  # if you have a seed script
```

### 2. Copy Schema File Only

If you just need to sync the schema without data:

```bash
# From MacBook, copy just the schema
scp prisma/schema.prisma yourusername@your-mac-mini-ip:~/re_platform/prisma/

# Then on Mac Mini:
npx prisma db push
```

## Full Data Sync Methods

### Method 1: Complete Database Dump (Current State)

Use the `sync-to-mac-mini.sh` script that was just created:

```bash
./sync-to-mac-mini.sh
```

### Method 2: Prisma-Native Approach

```bash
# 1. Generate SQL dump from current schema
npx prisma db execute --file schema-dump.sql --schema prisma/schema.prisma

# 2. Or use pg_dump directly
pg_dump postgresql://postgres:password@localhost:5432/re_platform > full-dump.sql

# 3. Transfer and restore on Mac Mini
scp full-dump.sql yourusername@your-mac-mini-ip:~/
ssh kappy@mac.local
psql postgresql://postgres:password@localhost:5432/re_platform < full-dump.sql
```

## Environment Setup on Mac Mini

### 1. Copy Environment File

```bash
# Copy environment configuration
scp .env.local yourusername@your-mac-mini-ip:~/re_platform/

# Or create new .env.local on Mac Mini with:
DATABASE_URL="postgresql://postgres:password@localhost:5432/re_platform"
# ... other environment variables
```

### 2. Install Dependencies

```bash
# On Mac Mini
cd ~/Downloads/re_platform
npm install
npx prisma generate
```

## Ongoing Development Workflow

### Option A: Schema-First Development

1. **Develop on MacBook** - Make schema changes in `prisma/schema.prisma`
2. **Push to MacBook DB** - `npx prisma db push`
3. **Sync schema to Mac Mini** - `scp prisma/schema.prisma kappy@mac.local:~/Downloads/re_platform/prisma/`
4. **Update Mac Mini DB** - `npx prisma db push` (on Mac Mini)

### Option B: Bi-directional Sync

1. **Use Git for schema sync** - Commit schema changes
2. **Pull on Mac Mini** - `git pull origin main`
3. **Apply schema** - `npx prisma db push`

## Database Connection Verification

Test connections on both machines:

```bash
# Test MacBook connection
npx prisma db execute --stdin <<< "SELECT 1 as test;"

# Test Mac Mini connection (after sync)
ssh kappy@mac.local "cd ~/Downloads/re_platform && npx prisma db execute --stdin <<< 'SELECT 1 as test;'"
```

## Data Migration Commands

### For specific table data:

```bash
# Export specific tables
pg_dump postgresql://postgres:password@localhost:5432/re_platform \
  --table=users --table=properties --data-only > essential-data.sql

# Import on Mac Mini
psql postgresql://postgres:password@localhost:5432/re_platform < essential-data.sql
```

### For development data reset:

```bash
# Clear and reseed (if you have seed scripts)
npx prisma db push --force-reset
npx prisma db seed
```

## Troubleshooting

### Schema Drift Issues

```bash
# Reset to clean state
npx prisma db push --force-reset

# Verify schema matches
npx prisma validate
```

### Connection Issues

```bash
# Test PostgreSQL is running
docker ps | grep postgres

# Test network connectivity
telnet your-mac-mini-ip 5432
```

### Performance Optimization

- Use `--data-only` dumps for faster transfers when schema hasn't changed
- Consider using `pg_dump` with `--jobs=4` for parallel dumps on large datasets
- Use rsync for code synchronization to avoid transferring unchanged files

## Security Notes

- Use SSH keys instead of passwords for frequent transfers
- Consider VPN if Mac Mini is not on local network
- Never commit database dumps to version control
- Use `.gitignore` for `*.sql` files and `backup_*` files