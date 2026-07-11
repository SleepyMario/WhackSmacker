CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_username text NOT NULL,
  normalized_username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  client_address text,
  user_agent text
);
CREATE INDEX sessions_user_active_idx ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source_locale text NOT NULL DEFAULT 'zh-Hant-TW',
  theme text NOT NULL DEFAULT 'light',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_packages (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id text NOT NULL,
  package_version text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, package_id, package_version)
);

CREATE TABLE review_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id text NOT NULL,
  package_version text NOT NULL,
  source_path text NOT NULL DEFAULT '',
  item_id text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_reviewed_at timestamptz,
  next_review_at timestamptz NOT NULL,
  review_count integer NOT NULL,
  lapse_count integer NOT NULL,
  interval_days double precision NOT NULL,
  ease_factor double precision NOT NULL,
  status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, package_id, package_version, source_path, item_id)
);

CREATE TABLE review_history (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id text NOT NULL,
  package_version text NOT NULL,
  source_path text NOT NULL DEFAULT '',
  item_id text NOT NULL,
  rating text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  previous_state jsonb NOT NULL,
  next_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_history_user_time_idx ON review_history(user_id, reviewed_at DESC);
