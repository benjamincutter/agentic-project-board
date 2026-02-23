import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn, execSync, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initDatabase, getDb, runMigrations, seedAgentProfiles } from './database';

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

// --- Datasets CRUD ---
ipcMain.handle('db:get-datasets', () => {
  const db = getDb();
  return db.prepare('SELECT * FROM datasets ORDER BY created_at DESC').all();
});

ipcMain.handle('db:create-dataset', (_event, data: { name: string; repo_path: string; description?: string }) => {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO datasets (name, repo_path, description) VALUES (?, ?, ?)')
    .run(data.name, data.repo_path, data.description ?? null);
  return db.prepare('SELECT * FROM datasets WHERE id = ?').get(result.lastInsertRowid);
});

ipcMain.handle('db:update-dataset', (_event, id: number, data: Record<string, unknown>) => {
  const db = getDb();
  const fields = Object.keys(data);
  if (fields.length === 0) return db.prepare('SELECT * FROM datasets WHERE id = ?').get(id);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => data[f]);
  db.prepare(`UPDATE datasets SET ${sets} WHERE id = ?`).run(...values, id);
  return db.prepare('SELECT * FROM datasets WHERE id = ?').get(id);
});

ipcMain.handle('db:delete-dataset', (_event, id: number) => {
  const db = getDb();
  db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
});

// --- Agent Profiles CRUD ---
ipcMain.handle('db:get-agent-profiles', (_event, agentType?: string) => {
  const db = getDb();
  if (agentType) {
    return db.prepare('SELECT * FROM agent_profiles WHERE agent_type = ? ORDER BY created_at DESC').all(agentType);
  }
  return db.prepare('SELECT * FROM agent_profiles ORDER BY created_at DESC').all();
});

ipcMain.handle('db:create-agent-profile', (_event, data: { name: string; agent_type?: string; content: string }) => {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO agent_profiles (name, agent_type, content) VALUES (?, ?, ?)')
    .run(data.name, data.agent_type ?? 'reviewer', data.content);
  return db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get(result.lastInsertRowid);
});

ipcMain.handle('db:update-agent-profile', (_event, id: number, data: Record<string, unknown>) => {
  const db = getDb();
  const fields = Object.keys(data);
  if (fields.length === 0) return db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get(id);
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => data[f]);
  db.prepare(`UPDATE agent_profiles SET ${sets} WHERE id = ?`).run(...values, id);
  return db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get(id);
});

ipcMain.handle('db:delete-agent-profile', (_event, id: number) => {
  const db = getDb();
  db.prepare('DELETE FROM agent_profiles WHERE id = ?').run(id);
});

// --- Agent Memories ---
ipcMain.handle('db:get-agent-memories', (_event, profileId: number) => {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_memories WHERE profile_id = ? ORDER BY created_at ASC').all(profileId);
});

ipcMain.handle('db:add-agent-memory', (_event, profileId: number, content: string) => {
  const db = getDb();
  const result = db.prepare('INSERT INTO agent_memories (profile_id, content) VALUES (?, ?)').run(profileId, content);
  return db.prepare('SELECT * FROM agent_memories WHERE id = ?').get(result.lastInsertRowid);
});

ipcMain.handle('db:delete-agent-memory', (_event, id: number) => {
  const db = getDb();
  db.prepare('DELETE FROM agent_memories WHERE id = ?').run(id);
});

// --- Profile-Dataset Linking ---
ipcMain.handle('db:get-profile-datasets', (_event, profileId: number) => {
  const db = getDb();
  return db.prepare(`
    SELECT d.* FROM datasets d
    JOIN profile_datasets pd ON pd.dataset_id = d.id
    WHERE pd.profile_id = ?
    ORDER BY d.name ASC
  `).all(profileId);
});

ipcMain.handle('db:link-profile-dataset', (_event, profileId: number, datasetId: number) => {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO profile_datasets (profile_id, dataset_id) VALUES (?, ?)')
    .run(profileId, datasetId);
});

ipcMain.handle('db:unlink-profile-dataset', (_event, profileId: number, datasetId: number) => {
  const db = getDb();
  db.prepare('DELETE FROM profile_datasets WHERE profile_id = ? AND dataset_id = ?')
    .run(profileId, datasetId);
});

// --- Agent Threads ---
const activeProcesses = new Map<number, ChildProcess>();
const reviewerPath = path.join(__dirname, '../../reviews/reviewer.ts');
const agentRunnerPath = path.join(__dirname, '../../reviews/agent-runner.ts');
const reviewsDir = path.join(__dirname, '../../reviews');

// Format a stream event as human-readable text for live_output column
function formatEventAsText(event: { type: string; [key: string]: unknown }): string {
  switch (event.type) {
    case 'thinking':
      return `[thinking] ${event.content}\n`;
    case 'text':
      return String(event.content ?? '');
    case 'tool_use':
      return `[tool: ${event.tool}] ${JSON.stringify(event.input)}\n`;
    case 'tool_result':
      return `[tool_result: ${event.tool}] ${String(event.output ?? '').slice(0, 200)}\n`;
    case 'result': {
      const data = event.data as { verdict?: string } | null;
      return `[result] ${data?.verdict ?? 'done'}\n`;
    }
    case 'diff_ready':
      return `[diff_ready] ${event.message ?? ''}\n`;
    default:
      return '';
  }
}

// Format a structured review result into a concise dialogue entry
function formatResultForDialogue(
  result: { verdict?: string; summary?: string; findings?: Array<{ severity: string; file?: string; line?: number; message: string }> } | null,
  agentName: string,
): string {
  if (!result?.verdict) return `${agentName} review completed (no structured result).`;

  const icon = result.verdict === 'approve' ? 'APPROVED' : 'CHANGES REQUESTED';
  const lines: string[] = [`**${icon}**`];

  if (result.summary) lines.push(result.summary);

  if (result.findings && result.findings.length > 0) {
    const blockers = result.findings.filter((f) => f.severity === 'blocker');
    const warnings = result.findings.filter((f) => f.severity === 'warning');
    const suggestions = result.findings.filter((f) => f.severity === 'suggestion');

    const formatFinding = (f: { file?: string; line?: number; message: string }) => {
      const loc = f.file ? `${f.file}${f.line ? ':' + f.line : ''}` : '';
      return `- ${loc ? loc + ' — ' : ''}${f.message}`;
    };

    if (blockers.length > 0) {
      lines.push('', `**Blockers (${blockers.length}):**`);
      blockers.forEach((f) => lines.push(formatFinding(f)));
    }
    if (warnings.length > 0) {
      lines.push('', `**Warnings (${warnings.length}):**`);
      warnings.forEach((f) => lines.push(formatFinding(f)));
    }
    if (suggestions.length > 0) {
      lines.push('', `**Suggestions (${suggestions.length}):**`);
      suggestions.forEach((f) => lines.push(formatFinding(f)));
    }
  } else {
    lines.push('No issues found.');
  }

  return lines.join('\n');
}

// Shared: wire up stdout JSON-line parsing + stderr + process close for a thread
function setupThreadProcess(threadId: number, proc: ChildProcess, tmpFile?: string) {
  const db = getDb();
  activeProcesses.set(threadId, proc);

  // Capture the structured result for the dialogue entry
  let lastResult: { verdict?: string; summary?: string; findings?: Array<{ severity: string; file?: string; line?: number; message: string }> } | null = null;

  let lineBuf = '';
  proc.stdout?.on('data', (buf: Buffer) => {
    lineBuf += buf.toString();
    const lines = lineBuf.split('\n');
    lineBuf = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        // Persist session_id when result arrives
        if (event.type === 'result' && event.sessionId) {
          db.prepare('UPDATE agent_threads SET session_id = ? WHERE id = ?')
            .run(event.sessionId, threadId);
        }
        // Capture structured result for dialogue
        if (event.type === 'result' && event.data) {
          lastResult = event.data;
        }
        // Handle diff_ready: capture git diff, store in DB, broadcast
        if (event.type === 'diff_ready') {
          const thread = db.prepare('SELECT * FROM agent_threads WHERE id = ?').get(threadId) as {
            dataset_id: number; mode: string;
          } | undefined;
          if (thread) {
            const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(thread.dataset_id) as {
              repo_path: string;
            } | undefined;
            if (dataset) {
              const repoPath = dataset.repo_path.replace(/^~/, process.env.HOME ?? '~');
              try {

                const diff = execSync('git diff', { cwd: repoPath, encoding: 'utf-8' });
                const cached = execSync('git diff --cached', { cwd: repoPath, encoding: 'utf-8' });
                const fullDiff = [cached, diff].filter(Boolean).join('\n');
                db.prepare('UPDATE agent_threads SET diff_output = ?, status = ? WHERE id = ?')
                  .run(fullDiff, 'paused', threadId);
                mainWindow?.webContents.send('thread:diff-ready', {
                  threadId,
                  diff: fullDiff,
                  commitMessage: event.message ?? '',
                });
              } catch {
                // git diff failed — still forward the event
              }
            }
          }
        }
        const text = formatEventAsText(event);
        if (text) {
          db.prepare('UPDATE agent_threads SET live_output = live_output || ? WHERE id = ?')
            .run(text, threadId);
        }
        mainWindow?.webContents.send('thread:event', { threadId, ...event });
      } catch {
        // Not JSON — raw text fallback
        db.prepare('UPDATE agent_threads SET live_output = live_output || ? WHERE id = ?')
          .run(line + '\n', threadId);
        mainWindow?.webContents.send('thread:event', { threadId, type: 'text', content: line + '\n' });
      }
    }
  });

  proc.stderr?.on('data', (buf: Buffer) => {
    const text = buf.toString();
    db.prepare('UPDATE agent_threads SET live_output = live_output || ? WHERE id = ?')
      .run(text, threadId);
    mainWindow?.webContents.send('thread:event', { threadId, type: 'text', content: text });
  });

  proc.on('close', (code: number | null) => {
    activeProcesses.delete(threadId);

    const finalStatus = code === 0 ? 'done' : 'failed';
    db.prepare(`
      UPDATE agent_threads SET status = ?, exit_code = ?, completed_at = datetime('now') WHERE id = ?
    `).run(finalStatus, code, threadId);

    // Write concise dialogue entry — just verdict + findings, not the full stream
    const thread = db.prepare('SELECT * FROM agent_threads WHERE id = ?').get(threadId) as {
      milestone_id: number; agent_name: string;
    } | undefined;
    if (thread) {
      const content = lastResult
        ? formatResultForDialogue(lastResult, thread.agent_name)
        : `${thread.agent_name} review ${finalStatus === 'done' ? 'completed' : 'failed'}.`;
      db.prepare(
        'INSERT INTO dialogue_entries (milestone_id, author, entry_type, content) VALUES (?, ?, ?, ?)',
      ).run(thread.milestone_id, thread.agent_name, 'note', content);
    }

    // Clean up temp file if provided
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }

    mainWindow?.webContents.send('thread:done', { threadId, status: finalStatus, exitCode: code });
  });
}

ipcMain.handle('thread:start', (_event, data: {
  projectId: number;
  milestoneId: number;
  datasetId: number;
  profileId: number;
  agentName: string;
}) => {
  const db = getDb();

  // Insert thread row
  const result = db.prepare(`
    INSERT INTO agent_threads (project_id, milestone_id, dataset_id, profile_id, agent_name, status)
    VALUES (?, ?, ?, ?, ?, 'running')
  `).run(data.projectId, data.milestoneId, data.datasetId, data.profileId, data.agentName);
  const threadId = result.lastInsertRowid as number;

  // Look up dataset + profile
  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(data.datasetId) as { repo_path: string } | undefined;
  const profile = db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get(data.profileId) as { content: string } | undefined;

  if (!dataset || !profile) {
    db.prepare("UPDATE agent_threads SET status = 'failed', exit_code = 1, completed_at = datetime('now') WHERE id = ?").run(threadId);
    return { threadId };
  }

  // Write temp payload file
  const tmpFile = path.join(os.tmpdir(), `agent-thread-${threadId}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({
    repoPath: dataset.repo_path,
    profileContent: profile.content,
  }));

  // Spawn reviewer process
  const proc = spawn('npx', ['tsx', reviewerPath, '--payload', tmpFile], {
    cwd: reviewsDir,
    shell: true,
    env: { ...process.env },
  });

  setupThreadProcess(threadId, proc, tmpFile);
  return { threadId };
});

ipcMain.handle('thread:follow-up', (_event, data: {
  parentThreadId: number;
  message: string;
}) => {
  const db = getDb();
  const parent = db.prepare('SELECT * FROM agent_threads WHERE id = ?')
    .get(data.parentThreadId) as {
      session_id: string | null;
      project_id: number;
      milestone_id: number;
      dataset_id: number;
      profile_id: number;
      agent_name: string;
    } | undefined;

  if (!parent?.session_id) throw new Error('No session to resume');

  // New thread row linked to parent
  const result = db.prepare(`
    INSERT INTO agent_threads
      (project_id, milestone_id, dataset_id, profile_id, agent_name, status, parent_thread_id)
    VALUES (?, ?, ?, ?, ?, 'running', ?)
  `).run(
    parent.project_id, parent.milestone_id, parent.dataset_id,
    parent.profile_id, parent.agent_name, data.parentThreadId,
  );
  const threadId = (result.lastInsertRowid as number);

  // Spawn reviewer in resume mode
  const proc = spawn('npx', [
    'tsx', reviewerPath, '--resume', parent.session_id, '--message', data.message,
  ], { cwd: reviewsDir, shell: true, env: { ...process.env } });

  setupThreadProcess(threadId, proc);
  return { threadId };
});

ipcMain.handle('thread:list', (_event, projectId: number) => {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_threads WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
});

ipcMain.handle('thread:get', (_event, threadId: number) => {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_threads WHERE id = ?').get(threadId);
});

// --- IDE Thread Lifecycle ---
ipcMain.handle('thread:start-ide', (_event, data: {
  projectId: number;
  milestoneId: number;
  taskId?: number;
  datasetId: number;
  profileId: number;
  agentName: string;
  prompt?: string;
}) => {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO agent_threads (project_id, milestone_id, task_id, dataset_id, profile_id, agent_name, status, mode)
    VALUES (?, ?, ?, ?, ?, ?, 'running', 'ide')
  `).run(data.projectId, data.milestoneId, data.taskId ?? null, data.datasetId, data.profileId, data.agentName);
  const threadId = result.lastInsertRowid as number;

  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(data.datasetId) as { repo_path: string } | undefined;
  const profile = db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get(data.profileId) as { content: string } | undefined;

  // Get task title for prompt if not provided
  let taskPrompt = data.prompt;
  if (!taskPrompt && data.taskId) {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.taskId) as { title: string } | undefined;
    taskPrompt = task?.title;
  }

  if (!dataset || !profile) {
    db.prepare("UPDATE agent_threads SET status = 'failed', exit_code = 1, completed_at = datetime('now') WHERE id = ?").run(threadId);
    return { threadId };
  }

  // Append memories to profile content
  const memories = db.prepare(
    'SELECT content FROM agent_memories WHERE profile_id = ? ORDER BY created_at ASC',
  ).all(data.profileId) as Array<{ content: string }>;

  let profileContent = profile.content;
  if (memories.length > 0) {
    profileContent += '\n\n---\n\n## Memories\n\n' + memories.map((m) => `- ${m.content}`).join('\n') + '\n';
  }

  const tmpFile = path.join(os.tmpdir(), `agent-ide-${threadId}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({
    repoPath: dataset.repo_path,
    profileContent,
    taskPrompt: taskPrompt ?? 'Complete the assigned task.',
  }));

  const proc = spawn('npx', ['tsx', agentRunnerPath, '--payload', tmpFile], {
    cwd: reviewsDir,
    shell: true,
    env: { ...process.env },
  });

  setupThreadProcess(threadId, proc, tmpFile);
  return { threadId };
});

ipcMain.handle('thread:approve-diff', (_event, threadId: number, commitMessage: string) => {
  const db = getDb();
  const thread = db.prepare('SELECT * FROM agent_threads WHERE id = ?').get(threadId) as {
    dataset_id: number; session_id: string | null;
  } | undefined;
  if (!thread) throw new Error('Thread not found');

  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(thread.dataset_id) as {
    repo_path: string;
  } | undefined;
  if (!dataset) throw new Error('Dataset not found');

  const repoPath = dataset.repo_path.replace(/^~/, process.env.HOME ?? '~');

  // Git add + commit
  execSync('git add -A', { cwd: repoPath });
  execSync(`git commit -m ${JSON.stringify(commitMessage)}`, { cwd: repoPath });

  // Clear diff output, set status back to running
  db.prepare('UPDATE agent_threads SET diff_output = NULL, status = ? WHERE id = ?')
    .run('running', threadId);

  // Resume agent session with approval message
  if (thread.session_id) {
    const proc = spawn('npx', [
      'tsx', agentRunnerPath, '--resume', thread.session_id,
      '--message', 'Changes committed. Continue with next chunk.',
    ], { cwd: reviewsDir, shell: true, env: { ...process.env } });

    setupThreadProcess(threadId, proc);
  }

  return { success: true };
});

ipcMain.handle('thread:reject-diff', (_event, threadId: number, feedback: string) => {
  const db = getDb();
  const thread = db.prepare('SELECT * FROM agent_threads WHERE id = ?').get(threadId) as {
    dataset_id: number; session_id: string | null;
  } | undefined;
  if (!thread) throw new Error('Thread not found');

  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(thread.dataset_id) as {
    repo_path: string;
  } | undefined;
  if (!dataset) throw new Error('Dataset not found');

  const repoPath = dataset.repo_path.replace(/^~/, process.env.HOME ?? '~');

  // Revert changes
  execSync('git checkout .', { cwd: repoPath });

  // Clear diff output, set status back to running
  db.prepare('UPDATE agent_threads SET diff_output = NULL, status = ? WHERE id = ?')
    .run('running', threadId);

  // Resume agent with rejection feedback
  if (thread.session_id) {
    const proc = spawn('npx', [
      'tsx', agentRunnerPath, '--resume', thread.session_id,
      '--message', `Rejected: ${feedback}. Please revise.`,
    ], { cwd: reviewsDir, shell: true, env: { ...process.env } });

    setupThreadProcess(threadId, proc);
  }

  return { success: true };
});

ipcMain.handle('thread:delegate-review', (_event, threadId: number, reviewerProfileId?: number) => {
  const db = getDb();
  const thread = db.prepare('SELECT * FROM agent_threads WHERE id = ?').get(threadId) as {
    project_id: number; milestone_id: number; dataset_id: number;
    diff_output: string | null;
  } | undefined;
  if (!thread) throw new Error('Thread not found');

  // Get reviewer profile — use provided or first available reviewer
  let reviewerProfile: { id: number; content: string } | undefined;
  if (reviewerProfileId) {
    reviewerProfile = db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get(reviewerProfileId) as typeof reviewerProfile;
  } else {
    reviewerProfile = db.prepare("SELECT * FROM agent_profiles WHERE agent_type = 'reviewer' LIMIT 1").get() as typeof reviewerProfile;
  }
  if (!reviewerProfile) throw new Error('No reviewer profile found');

  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(thread.dataset_id) as {
    repo_path: string;
  } | undefined;
  if (!dataset) throw new Error('Dataset not found');

  // Create a reviewer thread as child
  const result = db.prepare(`
    INSERT INTO agent_threads
      (project_id, milestone_id, dataset_id, profile_id, agent_name, status, parent_thread_id, mode)
    VALUES (?, ?, ?, ?, 'Reviewer', 'running', ?, 'review')
  `).run(
    thread.project_id, thread.milestone_id, thread.dataset_id,
    reviewerProfile.id, threadId,
  );
  const reviewThreadId = result.lastInsertRowid as number;

  // Write payload with the diff as content for review
  const tmpFile = path.join(os.tmpdir(), `agent-review-${reviewThreadId}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({
    repoPath: dataset.repo_path,
    profileContent: reviewerProfile.content,
  }));

  // Spawn reviewer on the captured diff
  const proc = spawn('npx', ['tsx', reviewerPath, '--payload', tmpFile], {
    cwd: reviewsDir,
    shell: true,
    env: { ...process.env },
  });

  setupThreadProcess(reviewThreadId, proc, tmpFile);
  return { threadId: reviewThreadId };
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
  seedAgentProfiles();
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
