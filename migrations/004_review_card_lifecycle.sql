ALTER TABLE review_progress
  ADD COLUMN pedagogical_fingerprint text,
  ADD COLUMN retired_at timestamptz,
  ADD CONSTRAINT review_progress_fingerprint_check
    CHECK (pedagogical_fingerprint IS NULL OR pedagogical_fingerprint ~ '^[a-f0-9]{64}$');

CREATE UNIQUE INDEX review_progress_v2_stable_identity_idx
  ON review_progress(user_id, package_id, item_id)
  WHERE pedagogical_fingerprint IS NOT NULL;

ALTER TABLE review_history
  ADD COLUMN pedagogical_fingerprint text,
  ADD CONSTRAINT review_history_fingerprint_check
    CHECK (pedagogical_fingerprint IS NULL OR pedagogical_fingerprint ~ '^[a-f0-9]{64}$');
