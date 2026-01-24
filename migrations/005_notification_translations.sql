-- Add MessageKey and MessageParams to notifications table
ALTER TABLE notifications ADD COLUMN message_key TEXT;
ALTER TABLE notifications ADD COLUMN message_params TEXT;
