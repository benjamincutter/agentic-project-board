-- Many-to-many: profiles ↔ repos (datasets)
CREATE TABLE IF NOT EXISTS profile_datasets (
  profile_id INTEGER NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, dataset_id)
);

-- Link threads to tasks
ALTER TABLE agent_threads ADD COLUMN task_id INTEGER REFERENCES tasks(id);

-- Thread mode: 'review' (existing) or 'ide' (new coding sessions)
ALTER TABLE agent_threads ADD COLUMN mode TEXT NOT NULL DEFAULT 'review';

-- Diff output captured after agent pauses
ALTER TABLE agent_threads ADD COLUMN diff_output TEXT;
