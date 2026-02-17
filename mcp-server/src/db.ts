import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { homedir } from 'os';

let db: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (db) return db;

  const dir = path.join(homedir(), '.agentic-project-board');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const dbPath = path.join(dir, 'board.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Ensure schema exists (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
      priority INTEGER NOT NULL DEFAULT 0,
      owner TEXT,
      description TEXT,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS milestone_dependencies (
      milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
      depends_on_milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
      PRIMARY KEY (milestone_id, depends_on_milestone_id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
      assignee TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS dialogue_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'note' CHECK (entry_type IN ('decision', 'progress', 'blocker', 'note')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO projects (id, name, description) VALUES (1, 'Rover MVP', 'Go CLI for local dataset preprocessing');
  `);

  return db;
};

// --- Projects ---

export const createProject = (data: { name: string; description?: string }) => {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO projects (name, description) VALUES (?, ?)',
  ).run(data.name, data.description ?? null);
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
};

export const listProjects = () => {
  const db = getDb();
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
};

// --- Query helpers ---

export const listMilestones = (projectId?: number, status?: string) => {
  const db = getDb();
  let sql = 'SELECT * FROM milestones WHERE 1=1';
  const params: unknown[] = [];
  if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY priority ASC, created_at ASC';
  return db.prepare(sql).all(...params);
};

export const createMilestone = (data: {
  project_id: number;
  name: string;
  status?: string;
  priority?: number;
  owner?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}) => {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO milestones (project_id, name, status, priority, owner, description, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.project_id,
    data.name,
    data.status ?? 'not_started',
    data.priority ?? 0,
    data.owner ?? null,
    data.description ?? null,
    data.start_date ?? null,
    data.end_date ?? null,
  );
  return db.prepare('SELECT * FROM milestones WHERE id = ?').get(result.lastInsertRowid);
};

export const updateMilestone = (id: number, data: Record<string, unknown>) => {
  const db = getDb();
  const fields = Object.keys(data);
  if (fields.length === 0) return db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => data[f]);
  db.prepare(`UPDATE milestones SET ${sets} WHERE id = ?`).run(...values, id);
  return db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
};

export const listTasks = (milestoneId?: number, status?: string, assignee?: string) => {
  const db = getDb();
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: unknown[] = [];
  if (milestoneId) { sql += ' AND milestone_id = ?'; params.push(milestoneId); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (assignee) { sql += ' AND assignee = ?'; params.push(assignee); }
  sql += ' ORDER BY created_at ASC';
  return db.prepare(sql).all(...params);
};

export const createTask = (data: {
  milestone_id: number;
  title: string;
  status?: string;
  assignee?: string;
}) => {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO tasks (milestone_id, title, status, assignee) VALUES (?, ?, ?, ?)',
  ).run(data.milestone_id, data.title, data.status ?? 'pending', data.assignee ?? null);
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
};

export const updateTask = (id: number, data: Record<string, unknown>) => {
  const db = getDb();
  const fields = Object.keys(data);
  if (data.status === 'done' && !data.completed_at) {
    data.completed_at = new Date().toISOString();
    if (!fields.includes('completed_at')) fields.push('completed_at');
  }
  if (fields.length === 0) return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => data[f]);
  db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...values, id);
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
};

export const logDialogue = (data: {
  milestone_id: number;
  author: string;
  entry_type: string;
  content: string;
}) => {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO dialogue_entries (milestone_id, author, entry_type, content) VALUES (?, ?, ?, ?)',
  ).run(data.milestone_id, data.author, data.entry_type, data.content);
  return db.prepare('SELECT * FROM dialogue_entries WHERE id = ?').get(result.lastInsertRowid);
};

export const getMilestoneDialogue = (milestoneId: number) => {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM dialogue_entries WHERE milestone_id = ? ORDER BY created_at DESC',
  ).all(milestoneId);
};

export const addDependency = (milestoneId: number, dependsOnId: number) => {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO milestone_dependencies (milestone_id, depends_on_milestone_id) VALUES (?, ?)',
  ).run(milestoneId, dependsOnId);
  return { milestone_id: milestoneId, depends_on_milestone_id: dependsOnId };
};

export const getProjectStatus = (projectId: number) => {
  const db = getDb();
  const milestones = db.prepare(
    'SELECT * FROM milestones WHERE project_id = ? ORDER BY priority ASC',
  ).all(projectId) as Array<{ id: number; status: string }>;

  const taskCounts = db.prepare(`
    SELECT t.status, COUNT(*) as count FROM tasks t
    JOIN milestones m ON t.milestone_id = m.id
    WHERE m.project_id = ?
    GROUP BY t.status
  `).all(projectId) as Array<{ status: string; count: number }>;

  const recentActivity = db.prepare(`
    SELECT d.*, m.name as milestone_name FROM dialogue_entries d
    JOIN milestones m ON d.milestone_id = m.id
    WHERE m.project_id = ?
    ORDER BY d.created_at DESC LIMIT 10
  `).all(projectId);

  return {
    milestones_by_status: {
      not_started: milestones.filter((m) => m.status === 'not_started').length,
      in_progress: milestones.filter((m) => m.status === 'in_progress').length,
      done: milestones.filter((m) => m.status === 'done').length,
    },
    total_milestones: milestones.length,
    task_counts: Object.fromEntries(taskCounts.map((t) => [t.status, t.count])),
    recent_activity: recentActivity,
  };
};
