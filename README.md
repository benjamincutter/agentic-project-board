# Agentic Project Board

A desktop app for humans to track what their AI agent teams are doing. Agents update the board through MCP tools; humans watch the Kanban board, dependency graph, and dialogue timeline update in real time.

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

## Architecture

```
Claude Code Agents ──stdio──> MCP Server (TypeScript)
                                    |
                                    v
                              SQLite (WAL mode)
                                    ^
                                    |
Electron App (React) <──IPC──> Main Process ──fs.watch──> DB file
```

- **Electron** owns the UI and reads the database over IPC
- **MCP server** is a stdio process that Claude Code spawns on demand — not a long-running service
- Both access the same SQLite file at `~/.agentic-project-board/board.db`
- WAL mode allows concurrent readers (Electron) and writer (MCP)
- File system watcher pushes changes to the UI within ~300ms of a write

## Views

**Kanban Board** — Three-column layout (Not Started / In Progress / Done). Click a milestone to see its tasks and dialogue.

**Dependency Graph** — DAG visualization of milestone dependencies. Nodes are colored by status. See at a glance what's blocked and what's ready.

**Dialogue Timeline** — Chronological feed of all agent and human communication, filterable by milestone, author, and type. Decisions and blockers get visual callouts.

## MCP Tools (13)

These are the tools your agents get when connected to the board:

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

## Roles

The board works best when agents have defined roles. Here's a starting point:

### Product Manager (runs the board)

The PM agent owns the board. It creates projects and milestones, sets priorities, makes scope decisions, and logs them. When you kick off work, start by telling your PM agent what you want built — it creates the project structure and assigns work.

Example system prompt addition:
> You are the product manager. Use the project board MCP tools to track all work. Create milestones for each initiative, break them into tasks, and log every decision as a dialogue entry. When other agents report progress, update their tasks accordingly.

### Engineers (update their own work)

Engineer agents pick up tasks, mark them in progress, log blockers, and mark them done. They use `log_dialogue` to explain what they did and flag issues.

Example system prompt addition:
> You have access to the project board. Before starting work, check your assigned tasks with `list_tasks`. Mark tasks `in_progress` when you start and `done` when you finish. Log any decisions or blockers as dialogue entries.

### QA (validates and catches issues)

A QA agent reviews completed work, logs test results as dialogue entries, and reopens tasks that fail validation.

### You (the human)

You watch the board in the Electron app. Use the broadcast button to send messages to your agents. Use the dialogue panel in milestone details to respond to specific blockers or approve decisions. Your name is tracked on everything you do.

## Adding Teammates (Connecting More Agents)

Every Claude Code session that should update the board needs access to the MCP server. There are two ways to do this:

### Option A: Global config (recommended)

Add the project board to your Claude Code global config so every session gets it, regardless of which repo you're working in:

```bash
claude mcp add --scope user project-board -- node /absolute/path/to/agentic-project-board/mcp-server/dist/index.js
```

Replace `/absolute/path/to/` with the actual path where you cloned this repo. After this, every new Claude Code session will have the 13 project board tools available.

To verify it worked, start a new Claude Code session and run `/mcp` — you should see `project-board` listed.

### Option B: Per-project config

If you only want certain repos to have board access, add a `.mcp.json` to that repo:

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

### How it works under the hood

When Claude Code starts a session, it reads the MCP config and spawns the server as a child process. Communication happens over stdin/stdout using JSON-RPC (the [Model Context Protocol](https://modelcontextprotocol.io)). The server opens the shared SQLite database, executes the tool call, and returns the result. No network, no ports, no auth — it's a local process talking to a local file.

When an agent writes to the database, the Electron app detects the change via filesystem watcher and refreshes the UI. The round trip from "agent calls MCP tool" to "you see it on screen" is under a second.

### Giving an agent its role

When you start a Claude Code session for a specific agent, include its role in the system prompt or CLAUDE.md. The agent will see the project board tools and use them according to its role. For example, a `CLAUDE.md` in your backend repo might include:

```markdown
## Project Board

You are "Cox" on the project board. Before starting any task:
1. Call `list_tasks` to see what's assigned to you
2. Call `update_task` to mark your current task as `in_progress`
3. When done, mark it `done` and call `log_dialogue` to explain what you did
```

## Tech Stack

| Component | Version |
|-----------|---------|
| Electron | 40.x |
| electron-vite | 5.x |
| React | 19.x |
| MUI | 7.x |
| React Flow | 12.x |
| better-sqlite3 | 12.x |
| MCP SDK | 1.x |

## License

MIT
