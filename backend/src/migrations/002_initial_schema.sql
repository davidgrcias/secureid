CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(512),
  industry VARCHAR(120),
  plan VARCHAR(32) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'business', 'enterprise')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(32) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(512),
  kyc_status VARCHAR(32) NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
  role VARCHAR(32) NOT NULL DEFAULT 'personal' CHECK (role IN ('personal', 'business', 'enterprise')),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL CHECK (role IN ('owner', 'admin', 'signer', 'viewer')),
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'deactivated')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  original_filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_hash_sha256 VARCHAR(128) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  page_count INTEGER,
  status VARCHAR(32) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'in_progress', 'completed', 'voided', 'expired')),
  sequential_signing BOOLEAN NOT NULL DEFAULT TRUE,
  auto_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envelope_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  signing_order INTEGER NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'signer' CHECK (role IN ('signer', 'viewer', 'approver')),
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'opened', 'signed', 'declined')),
  access_token VARCHAR(255) NOT NULL UNIQUE,
  signed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS envelope_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES envelope_recipients(id) ON DELETE SET NULL,
  field_type VARCHAR(32) NOT NULL CHECK (field_type IN ('signature', 'initial', 'date', 'text', 'checkbox')),
  page_number INTEGER NOT NULL,
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  width DOUBLE PRECISION NOT NULL,
  height DOUBLE PRECISION NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  value TEXT,
  filled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL CHECK (type IN ('draw', 'type', 'upload')),
  font_family VARCHAR(120),
  svg_data TEXT,
  image_path VARCHAR(512),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signing_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES envelope_recipients(id) ON DELETE CASCADE,
  signature_id UUID REFERENCES signatures(id) ON DELETE SET NULL,
  envelope_field_id UUID REFERENCES envelope_fields(id) ON DELETE SET NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  document_hash_before VARCHAR(128),
  document_hash_after VARCHAR(128),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(32) NOT NULL CHECK (action IN ('created', 'sent', 'opened', 'viewed', 'signed', 'declined', 'voided', 'downloaded', 'reminded')),
  ip_address VARCHAR(64),
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL CHECK (type IN ('ktp_photo', 'selfie', 'liveness')),
  file_path VARCHAR(512),
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'verified', 'failed')),
  result_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(512) NOT NULL UNIQUE,
  ip_address VARCHAR(64),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL CHECK (type IN ('signing_request', 'signed', 'completed', 'reminder', 'system')),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  action_url VARCHAR(512),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (org_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploader_id ON documents (uploader_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_document_id ON envelopes (document_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_sender_id ON envelopes (sender_id);
CREATE INDEX IF NOT EXISTS idx_envelope_recipients_envelope_id ON envelope_recipients (envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_fields_envelope_id ON envelope_fields (envelope_id);
CREATE INDEX IF NOT EXISTS idx_signatures_user_id ON signatures (user_id);
CREATE INDEX IF NOT EXISTS idx_signing_actions_recipient_id ON signing_actions (recipient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_envelope_id ON audit_logs (envelope_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
