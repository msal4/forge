-- Backfill empty full_name values with username for consistent display names.
UPDATE users SET full_name = username WHERE TRIM(full_name) = '';
