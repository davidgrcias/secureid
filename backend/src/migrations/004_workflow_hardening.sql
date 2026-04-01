ALTER TABLE envelopes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE envelopes
  ADD COLUMN IF NOT EXISTS signing_file_path VARCHAR(512);

ALTER TABLE envelopes
  ADD COLUMN IF NOT EXISTS signing_file_hash_sha256 VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_envelopes_updated_at ON envelopes (updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions (refresh_token);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_action_check'
      AND conrelid = 'audit_logs'::regclass
  ) THEN
    ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
  END IF;
END $$;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (
    action IN (
      'created',
      'updated',
      'sent',
      'opened',
      'viewed',
      'signed',
      'declined',
      'voided',
      'downloaded',
      'reminded'
    )
  );
