-- Fix: Grant the auth trigger permission to write to user tables
-- Paste this in Supabase SQL Editor and click Run

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE user_profiles TO supabase_auth_admin;
GRANT ALL ON TABLE pending_invites TO supabase_auth_admin;
GRANT ALL ON TABLE organizations TO supabase_auth_admin;
