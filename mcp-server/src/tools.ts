import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as db from './db.js';

export const registerTools = (server: McpServer) => {
  // --- Projects ---
  server.tool(
    'create_project',
    'Create a new project on the board',
    {
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Project description'),
    },
    async (args) => {
      const project = db.createProject(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(project, null, 2) }] };
    },
  );

  server.tool(
    'list_projects',
    'List all projects',
    {},
    async () => {
      const projects = db.listProjects();
      return { content: [{ type: 'text' as const, text: JSON.stringify(projects, null, 2) }] };
    },
  );

  // --- Milestones ---
  server.tool(
    'create_milestone',
    'Create a new milestone in the project board',
    {
      project_id: z.number().default(1).describe('Project ID (defaults to 1)'),
      name: z.string().describe('Milestone name'),
      priority: z.number().default(0).describe('Priority (0=P0 highest)'),
      owner: z.string().optional().describe('Owner/team member'),
      description: z.string().optional().describe('Description (markdown)'),
      status: z.enum(['not_started', 'in_progress', 'done']).default('not_started'),
      start_date: z.string().optional().describe('Start date (ISO)'),
      end_date: z.string().optional().describe('End date (ISO)'),
    },
    async (args) => {
      const milestone = db.createMilestone(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(milestone, null, 2) }] };
    },
  );

  server.tool(
    'update_milestone',
    'Update an existing milestone',
    {
      id: z.number().describe('Milestone ID'),
      name: z.string().optional(),
      status: z.enum(['not_started', 'in_progress', 'done']).optional(),
      priority: z.number().optional(),
      owner: z.string().optional(),
      description: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
    },
    async ({ id, ...data }) => {
      const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
      const milestone = db.updateMilestone(id, cleaned);
      return { content: [{ type: 'text' as const, text: JSON.stringify(milestone, null, 2) }] };
    },
  );

  server.tool(
    'list_milestones',
    'List milestones, optionally filtered by project or status',
    {
      project_id: z.number().default(1),
      status: z.enum(['not_started', 'in_progress', 'done']).optional(),
    },
    async (args) => {
      const milestones = db.listMilestones(args.project_id, args.status);
      return { content: [{ type: 'text' as const, text: JSON.stringify(milestones, null, 2) }] };
    },
  );

  // --- Tasks ---
  server.tool(
    'create_task',
    'Create a task within a milestone',
    {
      milestone_id: z.number().describe('Parent milestone ID'),
      title: z.string().describe('Task title'),
      assignee: z.string().optional().describe('Assigned team member'),
      status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
    },
    async (args) => {
      const task = db.createTask(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    'update_task',
    'Update a task status, assignee, etc.',
    {
      id: z.number().describe('Task ID'),
      title: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'done']).optional(),
      assignee: z.string().optional(),
    },
    async ({ id, ...data }) => {
      const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
      const task = db.updateTask(id, cleaned);
      return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    'list_tasks',
    'List tasks, filtered by milestone, status, or assignee',
    {
      milestone_id: z.number().optional(),
      status: z.enum(['pending', 'in_progress', 'done']).optional(),
      assignee: z.string().optional(),
    },
    async (args) => {
      const tasks = db.listTasks(args.milestone_id, args.status, args.assignee);
      return { content: [{ type: 'text' as const, text: JSON.stringify(tasks, null, 2) }] };
    },
  );

  server.tool(
    'assign_task',
    'Shorthand to assign a task to a team member',
    {
      id: z.number().describe('Task ID'),
      assignee: z.string().describe('Team member name'),
    },
    async ({ id, assignee }) => {
      const task = db.updateTask(id, { assignee });
      return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
    },
  );

  // --- Dialogue ---
  server.tool(
    'log_dialogue',
    'Log a dialogue entry (decision, progress, blocker, or note) on a milestone',
    {
      milestone_id: z.number().describe('Milestone ID'),
      author: z.string().describe('Author name (e.g. "Cox", "Kelso", "Human")'),
      entry_type: z.enum(['decision', 'progress', 'blocker', 'note']).describe('Entry type'),
      content: z.string().describe('Entry content (markdown supported)'),
    },
    async (args) => {
      const entry = db.logDialogue(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(entry, null, 2) }] };
    },
  );

  server.tool(
    'get_milestone_dialogue',
    'Get full dialogue history for a milestone',
    {
      milestone_id: z.number().describe('Milestone ID'),
    },
    async (args) => {
      const entries = db.getMilestoneDialogue(args.milestone_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
    },
  );

  // --- Dependencies ---
  server.tool(
    'add_dependency',
    'Add a dependency edge: milestone depends on another milestone',
    {
      milestone_id: z.number().describe('The milestone that depends on another'),
      depends_on_milestone_id: z.number().describe('The prerequisite milestone'),
    },
    async (args) => {
      const dep = db.addDependency(args.milestone_id, args.depends_on_milestone_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(dep, null, 2) }] };
    },
  );

  // --- Project Status ---
  server.tool(
    'get_project_status',
    'Get project summary: milestone counts by status, task counts, recent activity',
    {
      project_id: z.number().default(1),
    },
    async (args) => {
      const status = db.getProjectStatus(args.project_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }] };
    },
  );
};
