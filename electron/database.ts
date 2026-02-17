import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
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
