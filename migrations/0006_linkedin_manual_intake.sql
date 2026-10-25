CREATE TABLE linkedin_job_intakes (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT current_setting('hatchable.user_id', true),
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, canonical_url)
);
CREATE INDEX idx_linkedin_job_intakes_user_created ON linkedin_job_intakes(user_id, created_at DESC);
ALTER TABLE applications ADD COLUMN linkedin_intake_id BIGINT REFERENCES linkedin_job_intakes(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_applications_user_linkedin_intake ON applications(user_id, linkedin_intake_id) WHERE linkedin_intake_id IS NOT NULL;