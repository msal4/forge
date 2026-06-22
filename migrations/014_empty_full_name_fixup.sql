-- Normalize empty full_name values so COALESCE-style lookups behave consistently.
UPDATE users SET full_name = NULL WHERE TRIM(full_name) = '';
