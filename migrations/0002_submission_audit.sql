CREATE TABLE submission_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'needs_manual_action',
  reason TEXT NOT NULL DEFAULT '',
  external_reference TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_submission_attempts_user ON submission_attempts(user_id, created_at DESC);
CREATE INDEX idx_submission_attempts_app ON submission_attempts(application_id, created_at DESC);