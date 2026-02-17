import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, getDb, runMigrations } from './database';

let mainWindow: BrowserWindow | null = null;
let dbWatcher: fs.FSWatcher | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
};

// --- IPC Handlers ---

// Projects
ipcMain.handle('db:get-projects', () => {
  const db = getDb();
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
});

ipcMain.handle('db:get-default-project', () => {
  const db = getDb();
  return db.prepare('SELECT * FROM projects ORDER BY id LIMIT 1').get();
});

ipcMain.handle('db:create-project', (_event, data: { name: string; description?: string }) => {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO projects (name, description) VALUES (?, ?)')
    .run(data.name, data.description ?? null);
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
});

// Milestones
ipcMain.handle('db:get-milestones', (_event, projectId: number) => {
  const db = getDb();
  return db
    .prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY priority ASC, created_at ASC')
    .all(projectId);
});

ipcMain.handle('db:get-milestone', (_event, id: number) => {
  const db = getDb();
  return db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
});

ipcMain.handle('db:create-milestone', (_event, data: {
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
  const stmt = db.prepare(`
    INSERT INTO milestones (project_id, name, status, priority, owner, description, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
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
});

ipcMain.handle('db:update-milestone', (_event, id: number, data: Record<string, unknown>) => {
  const db = getDb();
  const fields = Object.keys(data);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => data[f]);
  db.prepare(`UPDATE milestones SET ${sets} WHERE id = ?`).run(...values, id);
  return db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
});

// Milestone dependencies
ipcMain.handle('db:get-milestone-dependencies', (_event, projectId: number) => {
  const db = getDb();
  return db
    .prepare(`
      SELECT md.* FROM milestone_dependencies md
      JOIN milestones m ON md.milestone_id = m.id
      WHERE m.project_id = ?
    `)
    .all(projectId);
});

ipcMain.handle('db:add-dependency', (_event, milestoneId: number, dependsOnId: number) => {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO milestone_dependencies (milestone_id, depends_on_milestone_id) VALUES (?, ?)',
  ).run(milestoneId, dependsOnId);
});

// Tasks
ipcMain.handle('db:get-tasks', (_event, milestoneId: number) => {
  const db = getDb();
  return db
    .prepare('SELECT * FROM tasks WHERE milestone_id = ? ORDER BY created_at ASC')
    .all(milestoneId);
});

ipcMain.handle('db:get-tasks-by-project', (_event, projectId: number) => {
  const db = getDb();
  return db
    .prepare(`
      SELECT t.* FROM tasks t
      JOIN milestones m ON t.milestone_id = m.id
      WHERE m.project_id = ?
      ORDER BY t.created_at ASC
    `)
    .all(projectId);
});

ipcMain.handle('db:create-task', (_event, data: {
  milestone_id: number;
  title: string;
  status?: string;
  assignee?: string;
}) => {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO tasks (milestone_id, title, status, assignee) VALUES (?, ?, ?, ?)')
    .run(data.milestone_id, data.title, data.status ?? 'pending', data.assignee ?? null);
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
});

ipcMain.handle('db:update-task', (_event, id: number, data: Record<string, unknown>) => {
  const db = getDb();
  if (data.status === 'done' && !data.completed_at) {
    data.completed_at = new Date().toISOString();
  }
  const fields = Object.keys(data);
  if (fields.length === 0) return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => data[f]);
  db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...values, id);
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
});

// Dialogue
ipcMain.handle('db:get-dialogue', (_event, milestoneId: number) => {
  const db = getDb();
  return db
    .prepare('SELECT * FROM dialogue_entries WHERE milestone_id = ? ORDER BY created_at DESC')
    .all(milestoneId);
});

ipcMain.handle('db:get-all-dialogue', (_event, projectId: number, limit: number = 50) => {
  const db = getDb();
  return db
    .prepare(`
      SELECT d.*, m.name as milestone_name FROM dialogue_entries d
      JOIN milestones m ON d.milestone_id = m.id
      WHERE m.project_id = ?
      ORDER BY d.created_at DESC
      LIMIT ?
    `)
    .all(projectId, limit);
});

ipcMain.handle('db:create-dialogue', (_event, data: {
  milestone_id: number;
  author: string;
  entry_type: string;
  content: string;
}) => {
  const db = getDb();
  const result = db
    .prepare(
      'INSERT INTO dialogue_entries (milestone_id, author, entry_type, content) VALUES (?, ?, ?, ?)',
    )
    .run(data.milestone_id, data.author, data.entry_type, data.content);
  return db.prepare('SELECT * FROM dialogue_entries WHERE id = ?').get(result.lastInsertRowid);
});

// Project status summary
ipcMain.handle('db:get-project-status', (_event, projectId: number) => {
  const db = getDb();
  const milestones = db
    .prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY priority ASC')
    .all(projectId) as Array<{ id: number; status: string }>;

  const taskCounts = db
    .prepare(`
      SELECT t.status, COUNT(*) as count FROM tasks t
      JOIN milestones m ON t.milestone_id = m.id
      WHERE m.project_id = ?
      GROUP BY t.status
    `)
    .all(projectId) as Array<{ status: string; count: number }>;

  const recentActivity = db
    .prepare(`
      SELECT d.*, m.name as milestone_name FROM dialogue_entries d
      JOIN milestones m ON d.milestone_id = m.id
      WHERE m.project_id = ?
      ORDER BY d.created_at DESC
      LIMIT 10
    `)
    .all(projectId);

  return {
    milestones_by_status: {
      not_started: milestones.filter((m) => m.status === 'not_started').length,
      in_progress: milestones.filter((m) => m.status === 'in_progress').length,
      done: milestones.filter((m) => m.status === 'done').length,
    },
    task_counts: Object.fromEntries(taskCounts.map((t) => [t.status, t.count])),
    recent_activity: recentActivity,
  };
});

// --- DB File Watcher ---
const watchDatabase = (dbPath: string) => {
  const walPath = dbPath + '-wal';

  const notify = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('db:changed');
    }
  };

  // Debounce to avoid flooding
  let timeout: NodeJS.Timeout | null = null;
  const debouncedNotify = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(notify, 300);
  };

  try {
    dbWatcher = fs.watch(path.dirname(dbPath), (_, filename) => {
      if (
        filename &&
        (filename === path.basename(dbPath) || filename === path.basename(walPath))
      ) {
        debouncedNotify();
      }
    });
  } catch {
    // fs.watch not available — polling in renderer will suffice
  }
};

// --- App Lifecycle ---
app.whenReady().then(() => {
  const dbPath = initDatabase();
  runMigrations();
  watchDatabase(dbPath);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (dbWatcher) dbWatcher.close();
  if (process.platform !== 'darwin') app.quit();
});
