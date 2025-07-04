-- Initialize RE Platform Database
-- This script runs automatically when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS staging;

-- Set up basic configuration
ALTER DATABASE re_platform SET timezone TO 'UTC';

-- Create initial tables structure placeholder
-- (Tables will be created by SQLAlchemy migrations)

-- Log initialization
INSERT INTO public.system_logs (created_at, level, message) 
VALUES (NOW(), 'INFO', 'Database initialized successfully')
ON CONFLICT DO NOTHING;