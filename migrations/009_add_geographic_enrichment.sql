-- Migration: Add geographic enrichment columns to accounts
-- Date: 2025-04-25
-- Description: Adds prospect_region_country_code for Vibe API enrichment
--              and employee_location_concentration for net new account detection

-- Add prospect_region_country_code (2-letter ISO country code from Vibe API / fallback)
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS prospect_region_country_code text DEFAULT NULL;

-- Add employee_location_concentration (JSON: {"city": "Seattle", "state": "WA", "concentration": 0.85})
-- Populated by Step 6 net new account detection or manual enrichment
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS employee_location_concentration jsonb DEFAULT NULL;

-- Index for filtering accounts missing region data
CREATE INDEX IF NOT EXISTS idx_accounts_prospect_region_null
ON accounts (id) WHERE prospect_region_country_code IS NULL;

-- Index for filtering accounts with concentration data
CREATE INDEX IF NOT EXISTS idx_accounts_employee_concentration
ON accounts USING gin (employee_location_concentration)
WHERE employee_location_concentration IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN accounts.prospect_region_country_code IS 'ISO 3166-1 alpha-2 country code from Explorium Vibe API or Serper fallback. Populated by weekly-intel Step 5A.';
COMMENT ON COLUMN accounts.employee_location_concentration IS 'JSON with city, state, concentration (0-1) of employees in a Rylem market. Populated by weekly-intel Step 6.';
