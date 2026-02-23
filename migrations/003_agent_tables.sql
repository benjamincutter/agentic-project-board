-- Datasets: target directories to review
CREATE TABLE IF NOT EXISTS datasets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  repo_path   TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent profiles: review criteria / agent configs
CREATE TABLE IF NOT EXISTS agent_profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  agent_type  TEXT NOT NULL DEFAULT 'reviewer',
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent threads: execution log
CREATE TABLE IF NOT EXISTS agent_threads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id  INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  dataset_id    INTEGER NOT NULL REFERENCES datasets(id),
  profile_id    INTEGER NOT NULL REFERENCES agent_profiles(id),
  agent_name    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'done', 'failed')),
  live_output   TEXT NOT NULL DEFAULT '',
  exit_code     INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

-- Seed: MC backend as a dataset + profile
INSERT INTO datasets (name, repo_path, description) VALUES (
  'Mission Control Backend',
  '~/hardshell/mission-control/backend',
  'FastAPI backend for the Mission Control web dashboard'
);

INSERT INTO agent_profiles (name, agent_type, content) VALUES (
  'mission-control-backend',
  'reviewer',
  '# Mission Control Backend — Review Profile

## Repo
~/hardshell/mission-control/backend

## Standards

### Clean Code (Robert Martin)
- Meaningful names — variables, functions, and classes should reveal intent
- Small functions — each function does one thing well
- Single Responsibility — classes and modules have one reason to change
- Comments are a last resort — prefer expressive code over comments

### DRY (Don''t Repeat Yourself)
- No duplicated logic — extract shared patterns into well-named abstractions
- Look for copy-pasted code blocks that differ only in minor details

### Unit Tests
- Business-critical service logic must have test coverage
- New service methods should have corresponding tests in tests/
- Test org-scoping behavior (ensure cross-org access is denied)

### Security — Org-Scoping
- NEVER accept organization_id from request parameters
- ALWAYS derive from current_user.organization_id
- Return 404 (not 403) for resources in different orgs — don''t leak existence
- Org-scoping must be enforced at service layer, not just resolvers

### SQLAlchemy Async
- Always eager load relationships with selectinload
- After mutations, re-query for complete object (don''t return stale)
- Use async session patterns consistently

### Alembic Migrations
- Use server_default (not default) for columns needing defaults during migration
- Verify migration is reversible (downgrade path exists)

### GraphQL (Strawberry)
- Types use from_model(cls, model) classmethod pattern
- DataLoaders for any relationship that can be queried in bulk
- Cast JSON types with cast(dict[str, Any], ...) for type safety

## Linter Checks
- `uv run ruff check src/` — must pass clean
- `uv run mypy src/` — must pass clean

## Severity Levels
- **blocker**: Must fix before commit (security holes, broken logic, missing org-scoping, failing linters)
- **warning**: Should fix (DRY violations, missing tests for critical paths, poor naming)
- **suggestion**: Nice to have (style improvements, minor refactors)'
);
