-- Allow users to opt in individually after two explicit risk confirmations.
-- The user preference remains disabled by default; this only opens the global feature gate.
UPDATE linkedin_scraper_control
SET enabled = true, kill_reason = '', updated_at = now()
WHERE id = 1;