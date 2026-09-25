ALTER TABLE review_progress
  DROP CONSTRAINT review_progress_status_check,
  ADD CONSTRAINT review_progress_status_check
    CHECK (status IN ('new', 'learning', 'review', 'mastered', 'suspended'));
