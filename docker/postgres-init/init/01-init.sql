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

-- Create a simple initialization log table for tracking
CREATE TABLE IF NOT EXISTS public.initialization_log (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message TEXT NOT NULL
);

-- Log initialization
INSERT INTO public.initialization_log (message) 
VALUES ('Database initialized successfully');