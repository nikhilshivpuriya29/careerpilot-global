CREATE TABLE linkedin_scraper_preferences (
  user_id TEXT PRIMARY KEY NOT NULL DEFAULT current_setting('hatchable.user_id', true),
  enabled BOOLEAN NOT NULL DEFAULT false,
  risk_acknowledged_at TIMESTAMPTZ,
  risk_notice_version TEXT NOT NULL DEFAULT '',
  search_day DATE NOT NULL DEFAULT CURRENT_DATE,
  search_count_today INTEGER NOT NULL DEFAULT 0 CHECK (search_count_today >= 0),
  detail_day DATE NOT NULL DEFAULT CURRENT_DATE,
  detail_count_today INTEGER NOT NULL DEFAULT 0 CHECK (detail_count_today >= 0),
  last_search_at TIMESTAMPTZ,
  paused_reason TEXT NOT NULL DEFAULT '',
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE linkedin_scraper_control (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  kill_reason TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO linkedin_scraper_control(id, enabled, kill_reason)
VALUES (1, true, '')
ON CONFLICT (id) DO NOTHING;
CREATE INDEX idx_linkedin_scraper_preferences_enabled ON linkedin_scraper_preferences(enabled, updated_at DESC);