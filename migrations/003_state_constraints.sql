ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_theme_check CHECK (theme IN ('light', 'dark'));

ALTER TABLE review_progress
  ADD CONSTRAINT review_progress_counts_check CHECK (review_count >= 0 AND lapse_count >= 0),
  ADD CONSTRAINT review_progress_status_check CHECK (status IN ('new', 'learning', 'review', 'suspended'));

ALTER TABLE review_history
  ADD CONSTRAINT review_history_rating_check CHECK (rating IN ('again', 'hard', 'good', 'easy'));
