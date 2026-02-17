import { contextBridge, ipcRenderer } from 'electron';

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

  // DB change listener
  onDbChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('db:changed', handler);
    return () => ipcRenderer.removeListener('db:changed', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
