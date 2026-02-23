import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Divider,
  Tab,
  Tabs,
  IconButton,
  Tooltip,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import AgentConversation from '../components/AgentConversation';
import AgentAvatar from '../components/AgentAvatar';
import DiffReviewPanel from '../components/DiffReviewPanel';
import {
  useMilestones,
  useTasksByProject,
  useDatasets,
  useAgentProfiles,
  useAgentThreads,
  useProfileDatasets,
} from '../hooks/useDatabase';
import type { AgentThread, ThreadStreamEvent } from '../types';

const LAUNCHER_WIDTH = 260;

interface Session {
  threadId: number;
  agentName: string;
  profileId: number;
  status: 'running' | 'done' | 'failed' | 'paused';
}

interface DiffState {
  threadId: number;
  diff: string;
  commitMessage: string;
}

interface Props {
  projectId: number;
}

const AgentIDE = ({ projectId }: Props) => {
  const milestones = useMilestones(projectId);
  const allTasks = useTasksByProject(projectId);
  const datasets = useDatasets();
  const profiles = useAgentProfiles();
  const threads = useAgentThreads(projectId);

  // Launcher form
  const [milestoneId, setMilestoneId] = useState<number | ''>('');
  const [taskId, setTaskId] = useState<number | ''>('');
  const [profileId, setProfileId] = useState<number | ''>('');
  const [datasetId, setDatasetId] = useState<number | ''>('');
  const [agentName, setAgentName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [launching, setLaunching] = useState(false);

  // Profile datasets for filtering
  const linkedDatasets = useProfileDatasets(profileId ? (profileId as number) : undefined);

  // Session tabs
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem('agent-ide-sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState(0);

  // Stream events
  const [threadEvents, setThreadEvents] = useState<Record<number, ThreadStreamEvent[]>>({});

  // Diff state
  const [activeDiff, setActiveDiff] = useState<DiffState | null>(null);
  const [showDiffPanel, setShowDiffPanel] = useState(false);

  // Persist sessions to localStorage
  useEffect(() => {
    localStorage.setItem('agent-ide-sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Subscribe to stream events
  useEffect(() => {
    const cleanupEvent = window.api.onThreadEvent((event) => {
      const { threadId, type, ...rest } = event;
      setThreadEvents((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] ?? []), { threadId, type, ...rest } as ThreadStreamEvent],
      }));
    });

    const cleanupDone = window.api.onThreadDone(({ threadId, status }) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.threadId === threadId ? { ...s, status: status as Session['status'] } : s,
        ),
      );
    });

    const cleanupDiffReady = window.api.onThreadDiffReady(({ threadId, diff, commitMessage }) => {
      setActiveDiff({ threadId, diff, commitMessage });
      setShowDiffPanel(true);
      setSessions((prev) =>
        prev.map((s) =>
          s.threadId === threadId ? { ...s, status: 'paused' } : s,
        ),
      );
    });

    return () => {
      cleanupEvent();
      cleanupDone();
      cleanupDiffReady();
    };
  }, []);

  // Sync session statuses from DB threads
  useEffect(() => {
    setSessions((prev) =>
      prev.map((s) => {
        const thread = threads.find((t) => t.id === s.threadId);
        if (thread && thread.status !== s.status) {
          return { ...s, status: thread.status };
        }
        return s;
      }),
    );
  }, [threads]);

  // Filter tasks by selected milestone
  const milestoneTasks = milestoneId
    ? allTasks.filter((t) => t.milestone_id === milestoneId)
    : allTasks;

  // Available datasets: linked to profile or all
  const availableDatasets = linkedDatasets.length > 0 ? linkedDatasets : datasets;

  const handleLaunch = async () => {
    if (!datasetId || !profileId || !agentName.trim() || !milestoneId) return;
    setLaunching(true);
    try {
      const { threadId } = await window.api.startIdeThread({
        projectId,
        milestoneId: milestoneId as number,
        taskId: taskId ? (taskId as number) : undefined,
        datasetId: datasetId as number,
        profileId: profileId as number,
        agentName: agentName.trim(),
        prompt: customPrompt.trim() || undefined,
      });
      const newSession: Session = {
        threadId,
        agentName: agentName.trim(),
        profileId: profileId as number,
        status: 'running',
      };
      setSessions((prev) => [...prev, newSession]);
      setActiveTab(sessions.length); // Switch to new tab
    } finally {
      setLaunching(false);
    }
  };

  const handleCloseSession = (index: number) => {
    setSessions((prev) => prev.filter((_, i) => i !== index));
    if (activeTab >= sessions.length - 1) {
      setActiveTab(Math.max(0, sessions.length - 2));
    }
  };

  const activeSession = sessions[activeTab];
  const activeThread = activeSession
    ? threads.find((t) => t.id === activeSession.threadId)
    : null;

  // Look up profile for avatar
  const getProfileForSession = (session: Session) =>
    profiles.find((p) => p.id === session.profileId);
  const activeProfile = activeSession ? getProfileForSession(activeSession) : null;

  const handleApproveDiff = async (msg: string) => {
    if (!activeSession) return;
    await window.api.approveDiff(activeSession.threadId, msg);
    setActiveDiff(null);
    setShowDiffPanel(false);
  };

  const handleRejectDiff = async (feedback: string) => {
    if (!activeSession) return;
    await window.api.rejectDiff(activeSession.threadId, feedback);
    setActiveDiff(null);
    setShowDiffPanel(false);
  };

  const handleDelegateReview = async () => {
    if (!activeSession) return;
    await window.api.delegateReview(activeSession.threadId);
  };

  const handleFollowUp = (message: string) => {
    if (!activeThread) return;
    window.api.followUpThread(activeThread.id, message);
  };

  // Status chip for session list
  const statusColor = (status: Session['status']) => {
    switch (status) {
      case 'running': return { bgcolor: 'rgba(33,150,243,0.15)', color: '#42a5f5' };
      case 'paused': return { bgcolor: 'rgba(255,167,38,0.15)', color: '#ffa726' };
      case 'done': return { bgcolor: 'rgba(76,175,80,0.15)', color: '#66bb6a' };
      case 'failed': return { bgcolor: 'rgba(244,67,54,0.15)', color: '#ef5350' };
    }
  };

  // IDE threads from DB for session list
  const ideThreads = threads.filter((t) => t.mode === 'ide');

  return (
    <Box sx={{ height: '100%', display: 'flex' }}>
      <Allotment>
        {/* Left: Launcher & Session List */}
        <Allotment.Pane preferredSize={LAUNCHER_WIDTH} minSize={200} maxSize={350}>
          <Box sx={{ height: '100%', overflow: 'auto', p: 2, borderRight: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Launch Agent
            </Typography>

            <Stack spacing={1.5}>
              <FormControl size="small" fullWidth>
                <InputLabel>Milestone</InputLabel>
                <Select
                  value={milestoneId}
                  label="Milestone"
                  onChange={(e) => {
                    setMilestoneId(e.target.value as number);
                    setTaskId('');
                  }}
                >
                  {milestones.map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Task</InputLabel>
                <Select
                  value={taskId}
                  label="Task"
                  onChange={(e) => setTaskId(e.target.value as number)}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {milestoneTasks.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                        {t.title}
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Profile</InputLabel>
                <Select
                  value={profileId}
                  label="Profile"
                  onChange={(e) => {
                    setProfileId(e.target.value as number);
                    setDatasetId(''); // Reset when profile changes
                  }}
                >
                  {profiles.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                      <Typography variant="caption" sx={{ ml: 0.5, opacity: 0.5 }}>
                        ({p.agent_type})
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Linked repos chips */}
              {linkedDatasets.length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {linkedDatasets.map((d) => (
                    <Chip
                      key={d.id}
                      size="small"
                      label={d.name}
                      variant={datasetId === d.id ? 'filled' : 'outlined'}
                      onClick={() => setDatasetId(d.id)}
                      sx={{ fontSize: '0.65rem' }}
                    />
                  ))}
                </Stack>
              )}

              <FormControl size="small" fullWidth>
                <InputLabel>Repo</InputLabel>
                <Select
                  value={datasetId}
                  label="Repo"
                  onChange={(e) => setDatasetId(e.target.value as number)}
                >
                  {availableDatasets.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Agent Name"
                placeholder="Cox, Elliot, Turk..."
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                fullWidth
              />

              <TextField
                size="small"
                label="Custom Prompt"
                placeholder="Optional — defaults to task title"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
              />

              <Button
                variant="contained"
                size="small"
                onClick={handleLaunch}
                disabled={launching || !datasetId || !profileId || !agentName.trim() || !milestoneId}
                startIcon={launching ? <CircularProgress size={14} /> : <PlayArrowIcon />}
              >
                {launching ? 'Launching...' : 'Launch Agent'}
              </Button>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Session list */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Sessions ({ideThreads.length})
            </Typography>

            <Stack spacing={0.75}>
              {sessions.map((session, idx) => {
                const profile = getProfileForSession(session);
                return (
                  <Box
                    key={session.threadId}
                    onClick={() => setActiveTab(idx)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 0.75,
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: activeTab === idx ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <AgentAvatar avatar={profile?.avatar} name={session.agentName} size={22} />
                    <Typography variant="body2" sx={{ flex: 1, fontWeight: activeTab === idx ? 600 : 400 }} noWrap>
                      {session.agentName}
                    </Typography>
                    <Chip
                      size="small"
                      label={session.status}
                      sx={{ ...statusColor(session.status), fontSize: '0.6rem', height: 20 }}
                    />
                  </Box>
                );
              })}
              {sessions.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  No active sessions
                </Typography>
              )}
            </Stack>
          </Box>
        </Allotment.Pane>

        {/* Center + Right: Conversation + Diff */}
        <Allotment.Pane>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Tab bar */}
            {sessions.length > 0 && (
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  minHeight: 36,
                  bgcolor: 'background.paper',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '& .MuiTab-root': { minHeight: 36, py: 0 },
                }}
              >
                {sessions.map((session, idx) => {
                  const profile = getProfileForSession(session);
                  return (
                    <Tab
                      key={session.threadId}
                      label={
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <AgentAvatar avatar={profile?.avatar} name={session.agentName} size={18} />
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            {session.agentName}
                          </Typography>
                          {session.status === 'running' && <CircularProgress size={10} />}
                          <Tooltip title="Close tab">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseSession(idx);
                              }}
                              sx={{ p: 0, ml: 0.5 }}
                            >
                              <CloseIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      }
                    />
                  );
                })}
              </Tabs>
            )}

            {/* Content area */}
            {activeSession ? (
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Allotment>
                  {/* Conversation pane */}
                  <Allotment.Pane>
                    <AgentConversation
                      threadId={activeSession.threadId}
                      events={threadEvents[activeSession.threadId] ?? []}
                      status={activeSession.status}
                      sessionId={activeThread?.session_id ?? null}
                      agentName={activeSession.agentName}
                      agentAvatar={activeProfile?.avatar}
                      onFollowUp={handleFollowUp}
                      onApproveDiff={handleApproveDiff}
                      onRejectDiff={handleRejectDiff}
                      onDelegateReview={handleDelegateReview}
                    />
                  </Allotment.Pane>

                  {/* Diff panel (shown when diff is ready) */}
                  {showDiffPanel && activeDiff && activeDiff.threadId === activeSession.threadId && (
                    <Allotment.Pane preferredSize="40%">
                      <DiffReviewPanel
                        diff={activeDiff.diff}
                        commitMessage={activeDiff.commitMessage}
                        onApprove={handleApproveDiff}
                        onReject={handleRejectDiff}
                        onDelegate={handleDelegateReview}
                        onClose={() => setShowDiffPanel(false)}
                      />
                    </Allotment.Pane>
                  )}
                </Allotment>
              </Box>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexDirection: 'column',
                  gap: 1,
                  opacity: 0.4,
                }}
              >
                <SmartToyIcon sx={{ fontSize: 48 }} />
                <Typography variant="body1">
                  Launch an agent to get started
                </Typography>
                <Typography variant="caption">
                  Select a task, profile, and repo in the left panel
                </Typography>
              </Box>
            )}
          </Box>
        </Allotment.Pane>
      </Allotment>
    </Box>
  );
};

export default AgentIDE;
