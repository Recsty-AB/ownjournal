-- Add 'icloud' as an allowed provider in user_credentials table
ALTER TABLE user_credentials DROP CONSTRAINT IF EXISTS user_credentials_provider_check;
ALTER TABLE user_credentials ADD CONSTRAINT user_credentials_provider_check 
  CHECK (provider IN ('google_drive', 'dropbox', 'nextcloud', 'icloud'));