-- Defense in depth: make the persisted LinkedIn scraper controls agree with the enforced code policy.
-- The scraper endpoints are disabled independently; this migration also clears any previous opt-ins.
ALTER TABLE linkedin_scraper_control
  ALTER COLUMN enabled SET DEFAULT false;

UPDATE linkedin_scraper_control
SET enabled = false,
    kill_reason = 'Automated LinkedIn scraping is disabled by CareerPilot safety policy.',
    updated_at = now()
WHERE id = 1;

UPDATE linkedin_scraper_preferences
SET enabled = false,
    risk_acknowledged_at = NULL,
    risk_notice_version = '',
    paused_reason = 'Automated LinkedIn scraping is disabled by CareerPilot safety policy.',
    paused_at = now(),
    updated_at = now();