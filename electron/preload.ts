import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const api = {
  // Projects
  getProjects: () => ipcRenderer.invoke('db:get-projects'),
  getDefaultProject: () => ipcRenderer.invoke('db:get-default-project'),
  createProject: (data: { name: string; description?: string }) =>
    ipcRenderer.invoke('db:create-project', data),

  // Milestones
  getMilestones: (projectId: number) => ipcRenderer.invoke('db:get-milestones', projectId),
  getMilestone: (id: number) => ipcRenderer.invoke('db:get-milestone', id),
  createMilestone: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:create-milestone', data),
  updateMilestone: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:update-milestone', id, data),

  // Dependencies
  getMilestoneDependencies: (projectId: number) =>
    ipcRenderer.invoke('db:get-milestone-dependencies', projectId),
  addDependency: (milestoneId: number, dependsOnId: number) =>
    ipcRenderer.invoke('db:add-dependency', milestoneId, dependsOnId),

  // Tasks
  getTasks: (milestoneId: number) => ipcRenderer.invoke('db:get-tasks', milestoneId),
  getTasksByProject: (projectId: number) =>
    ipcRenderer.invoke('db:get-tasks-by-project', projectId),
  createTask: (data: Record<string, unknown>) => ipcRenderer.invoke('db:create-task', data),
  updateTask: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:update-task', id, data),

  // Dialogue
  getDialogue: (milestoneId: number) => ipcRenderer.invoke('db:get-dialogue', milestoneId),
  getAllDialogue: (projectId: number, limit?: number) =>
    ipcRenderer.invoke('db:get-all-dialogue', projectId, limit),
  createDialogue: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:create-dialogue', data),

  // Status
  getProjectStatus: (projectId: number) =>
    ipcRenderer.invoke('db:get-project-status', projectId),

  // Datasets CRUD
  getDatasets: () => ipcRenderer.invoke('db:get-datasets'),
  createDataset: (data: { name: string; repo_path: string; description?: string }) =>
    ipcRenderer.invoke('db:create-dataset', data),
  updateDataset: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:update-dataset', id, data),
  deleteDataset: (id: number) => ipcRenderer.invoke('db:delete-dataset', id),

  // Agent Profiles CRUD
  getAgentProfiles: (agentType?: string) =>
    ipcRenderer.invoke('db:get-agent-profiles', agentType),
  createAgentProfile: (data: { name: string; agent_type?: string; content: string }) =>
    ipcRenderer.invoke('db:create-agent-profile', data),
  updateAgentProfile: (id: number, data: Record<string, unknown>) =>
    ipcRenderer.invoke('db:update-agent-profile', id, data),
  deleteAgentProfile: (id: number) => ipcRenderer.invoke('db:delete-agent-profile', id),

  // Agent Memories
  getAgentMemories: (profileId: number) =>
    ipcRenderer.invoke('db:get-agent-memories', profileId),
  addAgentMemory: (profileId: number, content: string) =>
    ipcRenderer.invoke('db:add-agent-memory', profileId, content),
  deleteAgentMemory: (id: number) =>
    ipcRenderer.invoke('db:delete-agent-memory', id),

  // Profile-Dataset linking
  getProfileDatasets: (profileId: number) =>
    ipcRenderer.invoke('db:get-profile-datasets', profileId),
  linkProfileDataset: (profileId: number, datasetId: number) =>
    ipcRenderer.invoke('db:link-profile-dataset', profileId, datasetId),
  unlinkProfileDataset: (profileId: number, datasetId: number) =>
    ipcRenderer.invoke('db:unlink-profile-dataset', profileId, datasetId),

  // Agent Threads (review)
  startThread: (data: {
    projectId: number;
    milestoneId: number;
    datasetId: number;
    profileId: number;
    agentName: string;
  }) => ipcRenderer.invoke('thread:start', data) as Promise<{ threadId: number }>,
  followUpThread: (parentThreadId: number, message: string) =>
    ipcRenderer.invoke('thread:follow-up', { parentThreadId, message }) as Promise<{ threadId: number }>,
  getThreads: (projectId: number) => ipcRenderer.invoke('thread:list', projectId),
  getThread: (id: number) => ipcRenderer.invoke('thread:get', id),

  // IDE Threads
  startIdeThread: (data: {
    projectId: number;
    milestoneId: number;
    taskId?: number;
    datasetId: number;
    profileId: number;
    agentName: string;
    prompt?: string;
  }) => ipcRenderer.invoke('thread:start-ide', data) as Promise<{ threadId: number }>,
  approveDiff: (threadId: number, commitMessage: string) =>
    ipcRenderer.invoke('thread:approve-diff', threadId, commitMessage) as Promise<{ success: boolean }>,
  rejectDiff: (threadId: number, feedback: string) =>
    ipcRenderer.invoke('thread:reject-diff', threadId, feedback) as Promise<{ success: boolean }>,
  delegateReview: (threadId: number, reviewerProfileId?: number) =>
    ipcRenderer.invoke('thread:delegate-review', threadId, reviewerProfileId) as Promise<{ threadId: number }>,

  // Stream event listeners
  onThreadEvent: (cb: (event: { threadId: number; type: string; [key: string]: unknown }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { threadId: number; type: string; [key: string]: unknown }) =>
      cb(data);
    ipcRenderer.on('thread:event', handler);
    return () => ipcRenderer.removeListener('thread:event', handler);
  },
  onThreadDone: (
    cb: (data: { threadId: number; status: string; exitCode: number | null }) => void,
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      data: { threadId: number; status: string; exitCode: number | null },
    ) => cb(data);
    ipcRenderer.on('thread:done', handler);
    return () => ipcRenderer.removeListener('thread:done', handler);
  },
  onThreadDiffReady: (
    cb: (data: { threadId: number; diff: string; commitMessage: string }) => void,
  ) => {
    const handler = (
      _event: IpcRendererEvent,
      data: { threadId: number; diff: string; commitMessage: string },
    ) => cb(data);
    ipcRenderer.on('thread:diff-ready', handler);
    return () => ipcRenderer.removeListener('thread:diff-ready', handler);
  },

  // DB change listener
  onDbChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('db:changed', handler);
    return () => ipcRenderer.removeListener('db:changed', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
