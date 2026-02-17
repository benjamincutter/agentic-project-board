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

export interface ProjectStatus {
  milestones_by_status: {
    not_started: number;
    in_progress: number;
    done: number;
  };
  task_counts: Record<string, number>;
  recent_activity: DialogueEntry[];
}
