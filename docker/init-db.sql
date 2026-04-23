-- PostgreSQL initialization script for HRFlow stack
-- This script runs automatically on first PostgreSQL container startup
-- (only when data directory is empty)

-- Create the n8n database for n8n workflow engine internals
-- (HRFlow database is created via POSTGRES_DB environment variable)
-- Use IF NOT EXISTS to make script idempotent
SELECT 'CREATE DATABASE n8n'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\gexec

-- Grant privileges to hrflow user on n8n database
GRANT ALL PRIVILEGES ON DATABASE n8n TO hrflow;

-- Connect to HRFlow database and create Core schema
\c "HRFlow"
CREATE SCHEMA IF NOT EXISTS "Core";
ALTER SCHEMA "Core" OWNER TO hrflow;
GRANT ALL ON SCHEMA "Core" TO hrflow;

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE '✅ HRFlow database initialization complete';
  RAISE NOTICE '   - Database "HRFlow" with schema "Core"';
  RAISE NOTICE '   - Database "n8n" for workflow engine';
END
$$;
