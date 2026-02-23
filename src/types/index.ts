export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  status: 'not_started' | 'in_progress' | 'done';
  priority: number;
  owner: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface MilestoneDependency {
  milestone_id: number;
  depends_on_milestone_id: number;
}

export interface Task {
  id: number;
  milestone_id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'done';
  assignee: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DialogueEntry {
  id: number;
  milestone_id: number;
  author: string;
  entry_type: 'decision' | 'progress' | 'blocker' | 'note';
  content: string;
  created_at: string;
  milestone_name?: string;
}

export interface Dataset {
  id: number;
  name: string;
  repo_path: string;
  description: string | null;
  created_at: string;
}

export interface AgentProfile {
  id: number;
  name: string;
  agent_type: string;
  content: string;
  avatar: string | null;
  created_at: string;
}

export interface ProfileDataset {
  profile_id: number;
  dataset_id: number;
}

export interface AgentThread {
  id: number;
  project_id: number;
  milestone_id: number;
  dataset_id: number;
  profile_id: number;
  agent_name: string;
  status: 'running' | 'done' | 'failed' | 'paused';
  live_output: string;
  exit_code: number | null;
  session_id: string | null;
  parent_thread_id: number | null;
  task_id: number | null;
  mode: 'review' | 'ide';
  diff_output: string | null;
  created_at: string;
  completed_at: string | null;
}

export type ThreadStreamEvent = {
  threadId: number;
} & (
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; output: string }
  | { type: 'result'; sessionId: string; data: unknown }
  | { type: 'diff_ready'; message: string }
);

export interface ProjectStatus {
  milestones_by_status: {
    not_started: number;
    in_progress: number;
    done: number;
  };
  task_counts: Record<string, number>;
  recent_activity: DialogueEntry[];
}
