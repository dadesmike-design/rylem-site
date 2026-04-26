-- Migration 010: Account Status System
-- Adds status tracking columns, trigger for auto-status, and backfills existing data

-- ============================================================
-- 1. ADD NEW COLUMNS
-- ============================================================

-- status column already exists (text) but has old values ('prospecting', 'researching')
-- We'll update those after adding the supporting columns

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by text,
  ADD COLUMN IF NOT EXISTS status_note text;

-- Set default for status column (already exists, just set default going forward)
ALTER TABLE accounts ALTER COLUMN status SET DEFAULT 'active';

-- Add check constraint for valid status values
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_status_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_status_check
  CHECK (status IN (
    'active',
    'meeting_set',
    'in_follow_up',
    'stalled',
    'on_hold',
    'closed_not_a_fit',
    'closed_lost',
    'dnc'
  ));

-- ============================================================
-- 2. BACKFILL EXISTING DATA
-- ============================================================

-- Update old status values to new vocabulary
UPDATE accounts SET status = 'active' WHERE status IN ('prospecting', 'researching') OR status IS NULL;

-- Set status_changed_at for existing rows (use updated_at or created_at as proxy)
UPDATE accounts SET status_changed_at = COALESCE(updated_at, created_at) WHERE status_changed_at IS NULL;

-- ============================================================
-- 3. AUTO-STATUS TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_account_status_from_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- meeting_set event → status = 'meeting_set'
  IF NEW.event_type = 'meeting_set' THEN
    UPDATE accounts SET
      status = 'meeting_set',
      status_changed_at = NOW(),
      status_changed_by = 'auto:meeting_set_trigger'
    WHERE id = NEW.account_id;
  END IF;

  -- meeting_completed event → status = 'in_follow_up'
  IF NEW.event_type = 'meeting_completed' THEN
    UPDATE accounts SET
      status = 'in_follow_up',
      status_changed_at = NOW(),
      status_changed_by = 'auto:meeting_completed_trigger'
    WHERE id = NEW.account_id;
  END IF;

  -- meeting_cancelled or meeting_no_show → status = 'active'
  IF NEW.event_type IN ('meeting_cancelled', 'meeting_no_show') THEN
    UPDATE accounts SET
      status = 'active',
      status_changed_at = NOW(),
      status_changed_by = 'auto:meeting_reset_trigger'
    WHERE id = NEW.account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_account_status_from_activity ON activity_log;
CREATE TRIGGER trg_account_status_from_activity
  AFTER INSERT ON activity_log
  FOR EACH ROW
  EXECUTE FUNCTION update_account_status_from_activity();

-- ============================================================
-- 4. HELPER: Set account status manually (with validation)
-- ============================================================

CREATE OR REPLACE FUNCTION set_account_status(
  p_account_id uuid,
  p_new_status text,
  p_changed_by text,
  p_note text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_old_status text;
  v_account_company text;
BEGIN
  -- Fetch current status
  SELECT status, company INTO v_old_status, v_account_company
  FROM accounts WHERE id = p_account_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Account not found');
  END IF;

  -- Validate: closed statuses require a note
  IF p_new_status IN ('closed_not_a_fit', 'closed_lost') AND (p_note IS NULL OR trim(p_note) = '') THEN
    RETURN jsonb_build_object('error', 'Mandatory note required for closed statuses');
  END IF;

  -- Update the account
  UPDATE accounts SET
    status = p_new_status,
    status_changed_at = NOW(),
    status_changed_by = p_changed_by,
    status_note = p_note
  WHERE id = p_account_id;

  RETURN jsonb_build_object(
    'success', true,
    'account_id', p_account_id,
    'company', v_account_company,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'changed_by', p_changed_by
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. HELPER: Detect stalled accounts (for weekly cron)
-- ============================================================

CREATE OR REPLACE FUNCTION detect_stalled_accounts()
RETURNS jsonb AS $$
DECLARE
  v_stalled_count int;
BEGIN
  -- Find accounts with status = 'meeting_set' for 14+ days with no meeting_completed
  UPDATE accounts a SET
    status = 'stalled',
    status_changed_at = NOW(),
    status_changed_by = 'auto:stalled_detection',
    status_note = 'Auto-detected: meeting_set for 14+ days with no meeting_completed'
  WHERE a.status = 'meeting_set'
    AND EXISTS (
      SELECT 1 FROM activity_log al
      WHERE al.account_id = a.id
        AND al.event_type = 'meeting_set'
        AND al.created_at < NOW() - INTERVAL '14 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM activity_log al
      WHERE al.account_id = a.id
        AND al.event_type = 'meeting_completed'
    );

  GET DIAGNOSTICS v_stalled_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'stalled_count', v_stalled_count,
    'checked_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. HELPER: Detect on-hold accounts with signal spike (for weekly cron)
-- ============================================================

CREATE OR REPLACE FUNCTION detect_on_hold_signal_spikes()
RETURNS TABLE(account_id uuid, company text, old_score int, new_score int, score_delta int) AS $$
BEGIN
  -- This is a placeholder — the weekly intel script already updates composite_signal_score
  -- We need to compare current score vs what it was when status was set to on_hold
  -- For now, we'll store the score at time of on_hold in status_note
  -- The weekly cron will do the comparison in Python using the REST API
  RETURN QUERY
    SELECT a.id, a.company,
      0 AS old_score,  -- placeholder, cron will calculate properly
      a.composite_signal_score AS new_score,
      a.composite_signal_score AS score_delta
    FROM accounts a
    WHERE a.status = 'on_hold'
      AND a.composite_signal_score >= 70;  -- only flag high-signal on-hold accounts
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. INDEX for status queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_status_changed_at ON accounts(status_changed_at);

-- ============================================================
-- VERIFICATION (run manually after migration)
-- ============================================================

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'accounts' AND column_name IN ('status', 'status_changed_at', 'status_changed_by', 'status_note');

-- SELECT status, count(*) FROM accounts GROUP BY status;
