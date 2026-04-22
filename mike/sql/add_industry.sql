-- Add industry column to accounts table
-- Rylem BDM Dashboard — 2026-04-22
-- Do NOT run without Mike's approval

ALTER TABLE accounts ADD COLUMN industry text;
ALTER TABLE accounts ADD COLUMN industry_notes text;
CREATE INDEX idx_accounts_industry ON accounts(industry);
