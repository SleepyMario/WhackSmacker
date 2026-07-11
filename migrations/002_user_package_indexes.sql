CREATE INDEX user_packages_user_enabled_idx ON user_packages(user_id, enabled);
CREATE INDEX review_progress_user_due_idx ON review_progress(user_id, next_review_at);
