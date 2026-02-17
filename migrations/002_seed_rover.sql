-- Seed Rover MVP milestones and data for initial demo

-- P1: Foundation (done)
INSERT OR IGNORE INTO milestones (id, project_id, name, status, priority, owner, description)
VALUES (1, 1, 'P1: CLI Foundation', 'done', 0, 'Cox',
  'Go CLI repo setup, CI/CD via GitHub Actions + GoReleaser, signed URL downloads');

-- P2: Authentication (in progress)
INSERT OR IGNORE INTO milestones (id, project_id, name, status, priority, owner, description)
VALUES (2, 1, 'P2: Authentication', 'in_progress', 1, 'Cox',
  'Browser-based login flow (gcloud-style). IAP transport middleware, HTTPS LB + custom OAuth client.');

-- P3: Local Pipeline
INSERT OR IGNORE INTO milestones (id, project_id, name, status, priority, owner, description)
VALUES (3, 1, 'P3: Local Pipeline', 'not_started', 2, 'Cox',
  'Dataset preprocessing pipeline running locally via rover CLI');

-- P4: Dashboard Integration
INSERT OR IGNORE INTO milestones (id, project_id, name, status, priority, owner, description)
VALUES (4, 1, 'P4: Dashboard Integration', 'not_started', 3, 'Elliot',
  'Mission Control UI for rover status and results viewing');

-- Dependencies: P2 depends on P1, P3 depends on P2, P4 depends on P3
INSERT OR IGNORE INTO milestone_dependencies (milestone_id, depends_on_milestone_id) VALUES (2, 1);
INSERT OR IGNORE INTO milestone_dependencies (milestone_id, depends_on_milestone_id) VALUES (3, 2);
INSERT OR IGNORE INTO milestone_dependencies (milestone_id, depends_on_milestone_id) VALUES (4, 3);

-- P1 tasks (all done)
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (1, 1, 'Initialize Go module and repo structure', 'done', 'Cox');
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (2, 1, 'GitHub Actions CI pipeline', 'done', 'Cox');
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (3, 1, 'GoReleaser config for signed binaries', 'done', 'Cox');
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (4, 1, 'Signed URL download mechanism', 'done', 'Cox');

-- P2 tasks (mix)
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (5, 2, 'IAP transport middleware', 'done', 'Cox');
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (6, 2, 'HTTPS LB + custom OAuth client (QA)', 'done', 'Cox');
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (7, 2, 'HTTPS LB + custom OAuth client (Prod)', 'done', 'Cox');
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (8, 2, 'rover login browser auth flow (CLI side)', 'in_progress', 'Cox');
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (9, 2, 'Backend redirect endpoint for OAuth callback', 'pending', 'Turk');
INSERT OR IGNORE INTO tasks (id, milestone_id, title, status, assignee) VALUES (10, 2, 'Token storage and refresh', 'pending', 'Cox');

-- Dialogue entries
INSERT OR IGNORE INTO dialogue_entries (id, milestone_id, author, entry_type, content) VALUES
  (1, 2, 'Kelso', 'decision', 'Browser-based login (gcloud-style) selected for MVP over device code flow. Simpler UX, leverages existing OAuth infrastructure.'),
  (2, 2, 'Cox', 'progress', 'IAP transport middleware working. Rover hits Mission Control 200 OK through IAP.'),
  (3, 2, 'Cox', 'progress', 'HTTPS LB + custom OAuth client deployed to both QA and Prod environments.'),
  (4, 2, 'Turk', 'note', 'Backend redirect endpoint needs to handle both QA and Prod callback URLs. Will use environment-based config.'),
  (5, 1, 'Cox', 'progress', 'P1 complete. CLI repo at hardshellinc/rover with full CI/CD pipeline.');
