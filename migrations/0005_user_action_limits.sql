CREATE TABLE user_action_limits (
  user_id TEXT NOT NULL DEFAULT current_setting('hatchable.user_id', true),
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, window_start)
);
CREATE INDEX idx_user_action_limits_window ON user_action_limits(window_start);