-- ============================================================
-- Post-migration verification — run after 001 + test data
-- ============================================================

-- 1. Verify account_signals columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'account_signals' 
ORDER BY ordinal_position;

-- 2. Verify account_signals row count (should be 6 including expired)
SELECT count(*) as total_signals FROM account_signals;

-- 3. Verify active signals for PACCAR (should be 5)
SELECT count(*) as active_paccar_signals 
FROM account_signals 
WHERE account_id = '64588de4-3db2-4a77-8b87-fdf5f4e4adbd' 
  AND (expires_at IS NULL OR expires_at > now());

-- 4. Verify new accounts columns
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
  AND column_name IN ('composite_signal_score','signal_last_updated','market','open_roles_breakdown','open_roles_last_updated','competitor_placed');

-- 5. Verify aop_rankings columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'aop_rankings' 
ORDER BY ordinal_position;

-- 6. Verify indexes exist
SELECT indexname, indexdef FROM pg_indexes 
WHERE tablename IN ('account_signals', 'aop_rankings') 
ORDER BY tablename, indexname;

-- 7. Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('account_signals', 'aop_rankings');
