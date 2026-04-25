-- ============================================================
-- Test data for account_signals — run AFTER migration 001
-- Uses PACCAR (account_id: 64588de4-3db2-4a77-8b87-fdf5f4e4adbd)
-- ============================================================

INSERT INTO public.account_signals (account_id, signal_type, source, headline, url, signal_score, market, detected_at, expires_at)
VALUES
  ('64588de4-3db2-4a77-8b87-fdf5f4e4adbd', 'hiring_surge', 'linkedin', 'PACCAR hiring 12 IT roles including Senior DevOps and Cloud Architect', null, 85, 'Seattle', now() - interval '2 days', now() + interval '28 days'),
  ('64588de4-3db2-4a77-8b87-fdf5f4e4adbd', 'funding', 'sec_filing', 'PACCAR Q1 earnings beat — $2B revenue, increasing tech investment', null, 72, 'Nationwide', now() - interval '5 days', now() + interval '60 days'),
  ('64588de4-3db2-4a77-8b87-fdf5f4e4adbd', 'leadership_change', 'news', 'New CTO appointed at PACCAR — former AWS VP of Engineering', null, 90, 'Seattle', now() - interval '1 day', now() + interval '45 days'),
  ('64588de4-3db2-4a77-8b87-fdf5f4e4adbd', 'expansion', 'news', 'PACCAR opening new downtown Seattle tech hub for 200 engineers', null, 78, 'Seattle', now() - interval '7 days', now() + interval '30 days'),
  ('64588de4-3db2-4a77-8b87-fdf5f4e4adbd', 'tech_adoption', 'linkedin', 'PACCAR job postings requiring Kubernetes and Terraform experience up 3x', null, 65, 'Seattle', now() - interval '3 days', now() + interval '21 days'),
  ('64588de4-3db2-4a77-8b87-fdf5f4e4adbd', 'hiring_surge', 'job_board', 'Expired signal — should NOT appear in results', null, 30, 'Seattle', now() - interval '30 days', now() - interval '1 day');

-- Verify: should return 5 rows (6th is expired)
-- SELECT headline, signal_score FROM account_signals WHERE account_id = '64588de4-3db2-4a77-8b87-fdf5f4e4adbd' AND (expires_at IS NULL OR expires_at > now()) ORDER BY signal_score DESC;
