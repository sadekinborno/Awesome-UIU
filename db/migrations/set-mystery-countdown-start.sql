-- Sets a global Mystery Countdown start time (UTC).
-- Run once when you're ready to start the 15-day countdown for everyone.

-- Ensure the key exists; do not overwrite if already started.
INSERT INTO app_settings (key, value)
VALUES ('mystery_countdown_start', NOW() AT TIME ZONE 'utc')
ON CONFLICT (key) DO NOTHING;

-- To restart the countdown intentionally, run this instead:
-- UPDATE app_settings
-- SET value = NOW() AT TIME ZONE 'utc', updated_at = NOW()
-- WHERE key = 'mystery_countdown_start';
