-- Migration 011: Add prior_client boolean to accounts table
-- Marks accounts that were Rylem clients in the past (re-engagement target)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS prior_client boolean DEFAULT false;

-- Verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'accounts' AND column_name = 'prior_client';
