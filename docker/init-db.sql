-- BankFlow PostgreSQL initialization script
-- Runs automatically on first container startup (empty data directory only)

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'BankFlow database initialized (user: bankflow, db: bankflow)';
END
$$;
