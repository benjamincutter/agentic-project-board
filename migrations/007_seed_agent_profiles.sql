-- Agent profile seeding is handled by seedAgentProfiles() in electron/database.ts
-- This reads profiles from ~/hardshell/.claude/agents/*/profile.md at app startup
-- and upserts them into agent_profiles with agent_type='coder'.
-- This migration file exists as a marker only.
SELECT 1;
