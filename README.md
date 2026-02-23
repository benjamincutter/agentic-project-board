# Agentic Project Board

A desktop app for humans to manage AI agent teams. Agents update the board through MCP tools; humans watch the Kanban board, dependency graph, and dialogue timeline update in real time. Run full coding sessions inside the app, review diffs GitHub-style, and approve commits before they land.

Built with Electron, React, SQLite, and the [Model Context Protocol](https://modelcontextprotocol.io).

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/agentic-project-board.git
cd agentic-project-board
npm install

# Build the MCP server
cd mcp-server && npm install && npm run build && cd ..

# Launch the app
npm run dev
```

On first launch, you'll be asked for your name. This is used to attribute any actions you take in the UI (dialogue entries, task updates, etc.).

## Getting Started

### 1. Register your repos

Click the Sacred Heart logo (top-left) and select **Manage Repos**. Add the local git repositories your agents will work in:

- **Name** — A short label (e.g. `mission-control`, `rover`)
- **Repo Path** — Absolute path to the local git repo (e.g. `/Users/you/projects/my-app`)
- **Description** — Optional, helps you remember what the repo is for

Repos are what agents operate on during coding sessions. You can link multiple repos to a single agent profile.

### 2. Set up your agents

Click the logo again and select **Manage Agents**. You can create agents from scratch or import them.

**Create from scratch:**
1. Click **New Agent**
2. Give it a name, pick a type (Coder, Reviewer, PM, QA), and write its system prompt
3. Optionally upload an avatar image — it'll show in conversations and tabs
4. Link it to one or more repos so the Agent IDE knows which codebases it can work in

**Import from Claude Code agents directory:**
Agent profiles from `~/.claude/agents/` are automatically imported on app startup. Each subdirectory with a `profile.md` file becomes a profile. Frontmatter `name:` and `type:` fields are parsed.

**Import/Export as JSON:**
Share agents with your team using the JSON format. In the agent list, hover over an agent and click the download icon to export. Click **Import** to load a `.agent.json` file. The format includes the profile content, avatar, and memories.

### 3. Create a project

Launch the app and create a project. Add milestones and tasks using the Kanban board. This gives your agents a shared understanding of what needs to be done.

### 4. Connect your agents via MCP

Every Claude Code session that should update the board needs the MCP server:

```bash
# Global config (recommended — every session gets it)
claude mcp add --scope user project-board -- node /absolute/path/to/agentic-project-board/mcp-server/dist/index.js
```

Or per-project via `.mcp.json`:

```json
{
  "mcpServers": {
    "project-board": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/agentic-project-board/mcp-server/dist/index.js"]
    }
  }
}
```

Verify with `/mcp` in any Claude Code session — you should see `project-board` listed.

### 5. Run coding sessions in the Agent IDE

Click the **Agent IDE** tab (or use the logo menu shortcut). Select a task, agent profile, and repo, then click **Launch Agent**. The agent works in commit-sized chunks:

1. Agent reads, edits, and writes code in the repo
2. At each logical commit boundary, the agent pauses and presents a diff
3. You review the diff GitHub-style in the right panel
4. **Approve & Commit** — creates a git commit and the agent continues
5. **Reject** — reverts changes, sends your feedback, and the agent revises
6. **Delegate to Reviewer** — spawns a reviewer agent to inspect the diff first

Multiple agents can run in parallel across different repos, each in its own tab.

## Architecture

```
Claude Code Agents ──stdio──> MCP Server (TypeScript)
                                    |
                                    v
                              SQLite (WAL mode)
                                    ^
                                    |
Electron App (React) <──IPC──> Main Process ──fs.watch──> DB file
                                    |
                                    v
                              Agent Runners (spawned processes)
                                    |
                                    v
                              Local Git Repos
```

- **Electron** owns the UI and reads the database over IPC
- **MCP server** is a stdio process that Claude Code spawns on demand — not a long-running service
- **Agent runners** are spawned by the Electron main process for coding sessions and code reviews
- All access the same SQLite file at `~/.agentic-project-board/board.db`
- WAL mode allows concurrent readers (Electron) and writer (MCP)
- File system watcher pushes changes to the UI within ~300ms of a write

## Views

**Kanban Board** — Three-column layout (Not Started / In Progress / Done). Click a milestone to see its tasks and dialogue.

**Dependency Graph** — DAG visualization of milestone dependencies. Nodes are colored by status. See at a glance what's blocked and what's ready.

**Dialogue Timeline** — Chronological feed of all agent and human communication, filterable by milestone, author, and type. Decisions and blockers get visual callouts.

**Agent IDE** — Full coding workspace. Launch agents on tasks, watch their conversations stream in real time, review diffs, and approve commits. Supports multiple concurrent sessions in tabs with resizable split panes.

## MCP Tools

These are the tools your agents get when connected to the board:

### Project Management (13 tools)

| Tool | What it does |
|------|-------------|
| `create_project` | Create a new project |
| `list_projects` | List all projects |
| `create_milestone` | Create a milestone with name, priority, owner |
| `update_milestone` | Update status, owner, description, etc. |
| `list_milestones` | List milestones, filter by project or status |
| `create_task` | Add a task to a milestone |
| `update_task` | Update task status or assignee |
| `list_tasks` | List tasks, filter by milestone, status, or assignee |
| `assign_task` | Shorthand for assigning a task |
| `log_dialogue` | Log a decision, progress update, blocker, or note |
| `get_milestone_dialogue` | Get full dialogue history for a milestone |
| `add_dependency` | Add a dependency edge between milestones |
| `get_project_status` | Summary with milestone counts, task stats, recent activity |

### Agent Profile Tools (5 tools)

| Tool | What it does |
|------|-------------|
| `list_agent_profiles` | List all registered agent profiles |
| `get_agent_profile` | Get a profile's full content including memories |
| `add_memory` | Add a persistent memory to an agent profile |
| `list_memories` | List all memories for a profile |
| `delete_memory` | Remove a memory |

Agent profiles can be loaded into Claude Code sessions via the `get_agent_profile` tool, so agents can self-load their own persona and accumulated memories from a single source of truth.

## Agent Profiles

### Structure

Each agent profile has:
- **Name** — Display name (e.g. "Dr. Cox")
- **Type** — `coder`, `reviewer`, `pm`, or `qa`
- **Content** — System prompt / persona markdown
- **Avatar** — Optional image shown in conversations
- **Memories** — Persistent notes accumulated across sessions
- **Linked Repos** — Which repositories this agent can work in

### Memories

Memories persist across coding sessions. They're appended to the agent's system prompt when a session starts. Use them for things like:
- Coding preferences learned during sessions
- Project-specific context the agent should always remember
- Patterns or conventions the agent discovered

Add memories manually in the Manage Agents dialog or programmatically via the `add_memory` MCP tool.

### Import/Export Format

Agents can be shared as JSON files:

```json
{
  "name": "Dr. Cox",
  "agent_type": "coder",
  "content": "# Dr. Cox\n\nYou are a senior engineer...",
  "avatar": "data:image/png;base64,...",
  "memories": [
    { "content": "Always use arrow functions", "created_at": "2025-01-15T..." }
  ]
}
```

## Roles

The board works best when agents have defined roles:

### Product Manager (runs the board)

The PM agent owns the board. It creates projects and milestones, sets priorities, makes scope decisions, and logs them. When you kick off work, start by telling your PM agent what you want built — it creates the project structure and assigns work.

### Engineers (update their own work)

Engineer agents pick up tasks, mark them in progress, log blockers, and mark them done. They use `log_dialogue` to explain what they did and flag issues.

### Reviewers (validate code changes)

Reviewer agents inspect diffs when you delegate a review from the Agent IDE. They analyze changes and report findings before you decide to approve or reject.

### QA (validates and catches issues)

A QA agent reviews completed work, logs test results as dialogue entries, and reopens tasks that fail validation.

### You (the human)

You watch the board in the Electron app. Use the broadcast button to send messages to your agents. Review diffs in the Agent IDE. Use the dialogue panel in milestone details to respond to specific blockers or approve decisions.

## Tech Stack

| Component | Version |
|-----------|---------|
| Electron | 40.x |
| electron-vite | 5.x |
| React | 19.x |
| MUI | 7.x |
| React Flow | 12.x |
| allotment | 1.x |
| better-sqlite3 | 12.x |
| MCP SDK | 1.x |
| Claude Agent SDK | 0.x |

## License

MIT
