-- Add session tracking and thread parenting for follow-ups
ALTER TABLE agent_threads ADD COLUMN session_id TEXT;
ALTER TABLE agent_threads ADD COLUMN parent_thread_id INTEGER REFERENCES agent_threads(id);
