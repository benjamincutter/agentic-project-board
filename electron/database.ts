import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from 'electron';

let db: Database.Database | null = null;
let dbPath: string = '';

export const getDbPath = (): string => {
  const dir = path.join(
    app?.getPath?.('home') ?? process.env.HOME ?? '~',
    '.agentic-project-board',
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'board.db');
};

export const initDatabase = (): string => {
  dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return dbPath;
};

export const getDb = (): Database.Database => {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
};

/**
 * Sync agent profiles from ~/.claude/agents/ into the DB.
 * Each subdirectory containing a profile.md becomes a profile row.
 * Uses upsert: existing profiles (matched by name) get their content updated,
 * new profiles are inserted. This keeps the DB in sync with the filesystem source of truth.
 */
export const seedAgentProfiles = () => {
  const database = getDb();

  // Look for agent profiles in the standard Claude Code agents directory
  const home = os.homedir();
  const agentDirs = [
    path.join(home, '.claude', 'agents'),
  ];

  for (const agentsDir of agentDirs) {
    if (!fs.existsSync(agentsDir)) continue;

    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const profilePath = path.join(agentsDir, entry.name, 'profile.md');
      if (!fs.existsSync(profilePath)) continue;

      const content = fs.readFileSync(profilePath, 'utf-8');

      // Parse frontmatter for name and description
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let profileName = entry.name;
      let agentType = 'coder';

      if (fmMatch) {
        const fm = fmMatch[1];
        const nameMatch = fm.match(/^name:\s*"?(.+?)"?\s*$/m);
        if (nameMatch) profileName = nameMatch[1];
        const typeMatch = fm.match(/^type:\s*"?(.+?)"?\s*$/m);
        if (typeMatch) agentType = typeMatch[1];
      }

      // Upsert: update content if name exists, otherwise insert
      const existing = database.prepare(
        'SELECT id FROM agent_profiles WHERE name = ?',
      ).get(profileName) as { id: number } | undefined;

      if (existing) {
        database.prepare(
          'UPDATE agent_profiles SET content = ?, agent_type = ? WHERE id = ?',
        ).run(content, agentType, existing.id);
      } else {
        database.prepare(
          'INSERT INTO agent_profiles (name, agent_type, content) VALUES (?, ?, ?)',
        ).run(profileName, agentType, content);
      }
    }
  }
};

export const runMigrations = () => {
  const database = getDb();

  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Read and apply migration files
  const migrationsDir = path.join(__dirname, '../../migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const applied = database
      .prepare('SELECT 1 FROM _migrations WHERE name = ?')
      .get(file);
    if (applied) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    database.exec(sql);
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
  }
};
