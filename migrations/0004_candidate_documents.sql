CREATE TABLE candidate_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT current_setting('hatchable.user_id', true),
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_candidate_documents_user_created ON candidate_documents(user_id, created_at DESC);