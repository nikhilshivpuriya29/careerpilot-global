CREATE TABLE candidate_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resume_text TEXT NOT NULL DEFAULT '',
  work_auth TEXT NOT NULL DEFAULT '',
  preferred_countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_salary TEXT NOT NULL DEFAULT '',
  notice_period TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE job_leads (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  salary_text TEXT NOT NULL DEFAULT '',
  visa_evidence TEXT NOT NULL DEFAULT 'unknown',
  visa_notes TEXT NOT NULL DEFAULT '',
  job_type TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closing_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  source_name TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE job_matches (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id BIGINT NOT NULL REFERENCES job_leads(id) ON DELETE CASCADE,
  fit_score INTEGER NOT NULL DEFAULT 0,
  visa_score INTEGER NOT NULL DEFAULT 0,
  salary_score INTEGER NOT NULL DEFAULT 0,
  match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);
CREATE TABLE applications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id BIGINT REFERENCES job_leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'saved',
  resume_version TEXT NOT NULL DEFAULT '',
  cover_letter TEXT NOT NULL DEFAULT '',
  application_url TEXT NOT NULL DEFAULT '',
  applied_at TIMESTAMPTZ,
  next_action TEXT NOT NULL DEFAULT '',
  next_action_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE automation_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'system',
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  items_found INTEGER NOT NULL DEFAULT 0,
  items_scored INTEGER NOT NULL DEFAULT 0,
  items_notified INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_leads_active_country ON job_leads(active, country, last_seen_at DESC);
CREATE INDEX idx_job_matches_user_score ON job_matches(user_id, fit_score DESC);
CREATE INDEX idx_applications_user_status ON applications(user_id, status, updated_at DESC);