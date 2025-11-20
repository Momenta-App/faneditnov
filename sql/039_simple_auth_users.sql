-- Migration: Simple Authentication Users Table
-- Creates a simple users table for hardcoded single-user authentication
-- This replaces Supabase auth for a simple single-user system

-- ============================================================================
-- USERS TABLE
-- Simple table for single hardcoded user authentication
-- ============================================================================

CREATE TABLE IF NOT EXISTS simple_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_simple_users_email ON simple_users(email);

-- ============================================================================
-- INSERT HARDCODED ADMIN USER
-- Email: admin@momenta.app
-- Password: Morning-fire444%
-- Password hash will be generated using bcrypt (cost factor 10)
-- ============================================================================

-- Note: The password hash below is a placeholder. 
-- You must generate the actual bcrypt hash for "Morning-fire444%" 
-- using a script or tool before running this migration.
-- 
-- To generate the hash, you can use Node.js:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('Morning-fire444%', 10);
-- console.log(hash);

-- For now, we'll insert a placeholder. The actual hash should be generated
-- and inserted via a script or manually updated after running this migration.

-- Insert hardcoded admin user with bcrypt hashed password
-- Password: Morning-fire444%
-- Note: If user already exists, this will update the password hash
INSERT INTO simple_users (email, password_hash)
VALUES (
  'admin@momenta.app',
  '$2b$10$UHpp83SeIHho5VySIeHP9OjBSFt4owjegCV9m2geqVr4X30Zk..By'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

COMMENT ON TABLE simple_users IS 'Simple authentication users table for single-user hardcoded auth system';
COMMENT ON COLUMN simple_users.password_hash IS 'BCrypt hashed password (cost factor 10)';

