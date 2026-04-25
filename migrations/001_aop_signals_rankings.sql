-- ============================================================
-- Rylem Schema Migration 001: AOP Account Signals + Rankings
-- Date: 2026-04-25
-- ============================================================

-- 1. NEW TABLE: account_signals
CREATE TABLE IF NOT EXISTS public.account_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  signal_type text NOT NULL,        -- e.g. 'hiring_surge', 'funding', 'leadership_change', 'expansion'
  source      text,                 -- e.g. 'linkedin', 'news', 'job_board', 'sec_filing'
  headline    text,
  url         text,
  signal_score integer DEFAULT 0,   -- 0-100 relevance score
  market      text,                 -- e.g. 'Seattle', 'San Francisco', 'Nationwide'
  detected_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Index on account_id (most frequent lookup: all signals for an account)
CREATE INDEX IF NOT EXISTS idx_account_signals_account_id ON public.account_signals(account_id);

-- Index on signal_type for filtering
CREATE INDEX IF NOT EXISTS idx_account_signals_signal_type ON public.account_signals(signal_type);

-- Index on detected_at for recency queries
CREATE INDEX IF NOT EXISTS idx_account_signals_detected_at ON public.account_signals(detected_at DESC NULLS LAST);

-- RLS: enable
ALTER TABLE public.account_signals ENABLE ROW LEVEL SECURITY;

-- RLS: service_role full access, anon read-only (adjust as needed)
CREATE POLICY "Service role full access on account_signals" ON public.account_signals
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anon read access on account_signals" ON public.account_signals
  FOR SELECT USING (true);


-- 2. ADD COLUMNS to existing accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS composite_signal_score integer,
  ADD COLUMN IF NOT EXISTS signal_last_updated timestamptz,
  ADD COLUMN IF NOT EXISTS market text,
  ADD COLUMN IF NOT EXISTS open_roles_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS open_roles_last_updated timestamptz,
  ADD COLUMN IF NOT EXISTS competitor_placed boolean DEFAULT false;

-- Index on composite_signal_score for ranking queries
CREATE INDEX IF NOT EXISTS idx_accounts_composite_signal_score ON public.accounts(composite_signal_score DESC NULLS LAST);

-- Index on market for territory filtering
CREATE INDEX IF NOT EXISTS idx_accounts_market ON public.accounts(market);

-- Index on competitor_placed for filtering
CREATE INDEX IF NOT EXISTS idx_accounts_competitor_placed ON public.accounts(competitor_placed) WHERE competitor_placed = true;


-- 3. NEW TABLE: aop_rankings
CREATE TABLE IF NOT EXISTS public.aop_rankings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep              text NOT NULL,           -- e.g. 'mike', 'julia', 'april', 'honey'
  account_id       uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  rank             integer NOT NULL,        -- 1 = highest priority
  tier             text NOT NULL,           -- e.g. 'A', 'B', 'C'
  rank_score       integer DEFAULT 0,       -- composite score used for ranking
  rank_reasoning   text,                    -- AI-generated explanation
  last_ranked_at   timestamptz DEFAULT now(),
  market           text                     -- territory/market segment
);

-- Index on account_id (lookup all rankings for an account)
CREATE INDEX IF NOT EXISTS idx_aop_rankings_account_id ON public.aop_rankings(account_id);

-- Composite index on rep + tier (most frequent query: "show me my A-tier accounts")
CREATE INDEX IF NOT EXISTS idx_aop_rankings_rep_tier ON public.aop_rankings(rep, tier);

-- Index on rep alone (show all ranked accounts for a rep)
CREATE INDEX IF NOT EXISTS idx_aop_rankings_rep ON public.aop_rankings(rep);

-- Index on rank for ordering
CREATE INDEX IF NOT EXISTS idx_aop_rankings_rank ON public.aop_rankings(rank ASC);

-- Unique constraint: one ranking per rep per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_aop_rankings_rep_account_unique ON public.aop_rankings(rep, account_id);

-- RLS: enable
ALTER TABLE public.aop_rankings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role full access on aop_rankings" ON public.aop_rankings
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anon read access on aop_rankings" ON public.aop_rankings
  FOR SELECT USING (true);


-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'account_signals' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'aop_rankings' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts' AND column_name IN ('composite_signal_score','signal_last_updated','market','open_roles_breakdown','open_roles_last_updated','competitor_placed');
-- SELECT count(*) FROM account_signals;
-- SELECT count(*) FROM aop_rankings;
