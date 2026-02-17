import { useState, useEffect } from 'react';
import type { Project, Milestone, MilestoneDependency, Task, DialogueEntry } from '../types';

const useRefreshTrigger = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Listen for MCP-triggered DB changes via fs.watch
    const cleanup = window.api.onDbChanged(() => setTick((t) => t + 1));

    // Belt-and-suspenders: poll every 2s
    const interval = setInterval(() => setTick((t) => t + 1), 2000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  return tick;
};

export const useDefaultProject = () => {
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    window.api.getDefaultProject().then(setProject);
  }, []);

  return project;
};

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const tick = useRefreshTrigger();

  useEffect(() => {
    window.api.getProjects().then(setProjects);
  }, [tick]);

  return projects;
};

export const useMilestones = (projectId: number | undefined) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const tick = useRefreshTrigger();

  useEffect(() => {
    if (!projectId) return;
    window.api.getMilestones(projectId).then(setMilestones);
  }, [projectId, tick]);

  return milestones;
};

export const useMilestoneDependencies = (projectId: number | undefined) => {
  const [deps, setDeps] = useState<MilestoneDependency[]>([]);
  const tick = useRefreshTrigger();

  useEffect(() => {
    if (!projectId) return;
    window.api.getMilestoneDependencies(projectId).then(setDeps);
  }, [projectId, tick]);

  return deps;
};

export const useTasks = (milestoneId: number | undefined) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const tick = useRefreshTrigger();

  useEffect(() => {
    if (!milestoneId) return;
    window.api.getTasks(milestoneId).then(setTasks);
  }, [milestoneId, tick]);

  return tasks;
};

export const useTasksByProject = (projectId: number | undefined) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const tick = useRefreshTrigger();

  useEffect(() => {
    if (!projectId) return;
    window.api.getTasksByProject(projectId).then(setTasks);
  }, [projectId, tick]);

  return tasks;
};

export const useDialogue = (milestoneId: number | undefined) => {
  const [entries, setEntries] = useState<DialogueEntry[]>([]);
  const tick = useRefreshTrigger();

  useEffect(() => {
    if (!milestoneId) return;
    window.api.getDialogue(milestoneId).then(setEntries);
  }, [milestoneId, tick]);

  return entries;
};

export const useAllDialogue = (projectId: number | undefined, limit: number = 50) => {
  const [entries, setEntries] = useState<DialogueEntry[]>([]);
  const tick = useRefreshTrigger();

  useEffect(() => {
    if (!projectId) return;
    window.api.getAllDialogue(projectId, limit).then(setEntries);
  }, [projectId, limit, tick]);

  return entries;
};
