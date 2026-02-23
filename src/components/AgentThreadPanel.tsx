import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Drawer,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import type { Milestone, AgentThread, AgentProfile, Dataset, ThreadStreamEvent } from '../types';
import { useDatasets, useAgentProfiles, useAgentThreads, useProfileDatasets } from '../hooks/useDatabase';

const PANEL_WIDTH = 350;

interface Props {
  projectId: number;
  milestones: Milestone[];
}

const AgentThreadPanel = ({ projectId, milestones }: Props) => {
  const [open, setOpen] = useState(false);
  const datasets = useDatasets();
  const profiles = useAgentProfiles('reviewer');
  const threads = useAgentThreads(projectId);

  // Form state
  const [datasetId, setDatasetId] = useState<number | ''>('');
  const [profileId, setProfileId] = useState<number | ''>('');
  const [agentName, setAgentName] = useState('');
  const [milestoneId, setMilestoneId] = useState<number | ''>('');
  const [starting, setStarting] = useState(false);

  // Profile editor state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AgentProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileContent, setProfileContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Profile-dataset linking
  const linkedDatasets = useProfileDatasets(editingProfile?.id);

  // Stream events tracking
  const [threadEvents, setThreadEvents] = useState<Record<number, ThreadStreamEvent[]>>({});
  const [expandedThread, setExpandedThread] = useState<number | null>(null);
  const [thinkingExpanded, setThinkingExpanded] = useState<Record<string, boolean>>({});
  const [toolResultExpanded, setToolResultExpanded] = useState<Record<string, boolean>>({});
  const outputRef = useRef<HTMLDivElement>(null);

  // Follow-up state
  const [followUpMsg, setFollowUpMsg] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // Default selections when data loads
  useEffect(() => {
    if (datasets.length > 0 && datasetId === '') setDatasetId(datasets[0].id);
  }, [datasets, datasetId]);

  useEffect(() => {
    if (profiles.length > 0 && profileId === '') setProfileId(profiles[0].id);
  }, [profiles, profileId]);

  // Subscribe to stream events
  useEffect(() => {
    const cleanupEvent = window.api.onThreadEvent((event) => {
      const { threadId, type, ...rest } = event;
      setThreadEvents((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] ?? []), { threadId, type, ...rest } as ThreadStreamEvent],
      }));
    });

    const cleanupDone = window.api.onThreadDone(() => {
      // DB poll will pick up the final state
    });

    return () => {
      cleanupEvent();
      cleanupDone();
    };
  }, []);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [threadEvents, expandedThread]);

  const handleStart = async () => {
    if (!datasetId || !profileId || !agentName.trim() || !milestoneId) return;
    setStarting(true);
    try {
      const { threadId } = await window.api.startThread({
        projectId,
        milestoneId: milestoneId as number,
        datasetId: datasetId as number,
        profileId: profileId as number,
        agentName: agentName.trim(),
      });
      setExpandedThread(threadId);
      setAgentName('');
    } finally {
      setStarting(false);
    }
  };

  const handleFollowUp = async (thread: AgentThread) => {
    if (!followUpMsg.trim() || followUpLoading) return;
    setFollowUpLoading(true);
    try {
      const { threadId } = await window.api.followUpThread(thread.id, followUpMsg.trim());
      setFollowUpMsg('');
      setExpandedThread(threadId);
    } finally {
      setFollowUpLoading(false);
    }
  };

  // Collapse events for display: merge consecutive thinking into one "latest" block,
  // keep everything else as-is
  const collapseEvents = (events: ThreadStreamEvent[]) => {
    const collapsed: { event: ThreadStreamEvent; idx: number }[] = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.type === 'thinking') {
        // Look ahead: if the next event is also thinking, skip this one
        if (i + 1 < events.length && events[i + 1].type === 'thinking') continue;
        // This is the latest thinking in this consecutive run — keep it
      }
      collapsed.push({ event, idx: i });
    }
    return collapsed;
  };

  // Render stream events for a thread
  const renderEvents = (events: ThreadStreamEvent[]) => {
    const collapsed = collapseEvents(events);

    return collapsed.map(({ event, idx }) => {
      const key = `${event.threadId}-${idx}`;
      switch (event.type) {
        case 'thinking': {
          const isOpen = thinkingExpanded[key] ?? false;
          return (
            <Box key={key} sx={{ mb: 0.5 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', opacity: 0.6 }}
                onClick={() => setThinkingExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
              >
                <PsychologyIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" sx={{ fontStyle: 'italic' }}>thinking...</Typography>
                {isOpen ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
              </Box>
              <Collapse in={isOpen}>
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{
                    fontStyle: 'italic',
                    opacity: 0.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.65rem',
                    ml: 2.5,
                  }}
                >
                  {event.content}
                </Typography>
              </Collapse>
            </Box>
          );
        }
        case 'text':
          return (
            <Typography
              key={key}
              variant="body2"
              component="span"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem' }}
            >
              {event.content}
            </Typography>
          );
        case 'tool_use': {
          const inputSummary = event.input.file_path
            ? String(event.input.file_path)
            : event.input.pattern
              ? String(event.input.pattern)
              : event.input.command
                ? String(event.input.command).slice(0, 60)
                : '';
          return (
            <Chip
              key={key}
              size="small"
              icon={<BuildIcon sx={{ fontSize: '14px !important' }} />}
              label={`${event.tool} ${inputSummary}`}
              sx={{
                my: 0.25,
                maxWidth: '100%',
                height: 'auto',
                '& .MuiChip-label': {
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: '0.65rem',
                },
                bgcolor: 'rgba(33,150,243,0.1)',
              }}
            />
          );
        }
        case 'tool_result': {
          const isOpen = toolResultExpanded[key] ?? false;
          return (
            <Box key={key} sx={{ mb: 0.25 }}>
              <Typography
                variant="caption"
                sx={{ cursor: 'pointer', opacity: 0.5, fontSize: '0.6rem' }}
                onClick={() => setToolResultExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
              >
                {isOpen ? '\u25BC' : '\u25B6'} result ({event.tool})
              </Typography>
              <Collapse in={isOpen}>
                <Typography
                  component="pre"
                  sx={{
                    fontSize: '0.6rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 120,
                    overflow: 'auto',
                    opacity: 0.6,
                    ml: 1,
                  }}
                >
                  {event.output}
                </Typography>
              </Collapse>
            </Box>
          );
        }
        case 'result': {
          const data = event.data as { verdict?: string; summary?: string } | null;
          if (!data?.verdict) return null;
          const isApproved = data.verdict === 'approve';
          return (
            <Box key={key} sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isApproved ? (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#66bb6a' }} />
              ) : (
                <ErrorIcon sx={{ fontSize: 16, color: '#ef5350' }} />
              )}
              <Chip
                size="small"
                label={isApproved ? 'Approved' : 'Changes Requested'}
                sx={{
                  bgcolor: isApproved ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                  color: isApproved ? '#66bb6a' : '#ef5350',
                  fontWeight: 600,
                }}
              />
              {data.summary && (
                <Typography variant="caption" sx={{ ml: 0.5, opacity: 0.7 }}>
                  {data.summary}
                </Typography>
              )}
            </Box>
          );
        }
        default:
          return null;
      }
    });
  };

  const statusChip = (status: AgentThread['status']) => {
    switch (status) {
      case 'running':
        return (
          <Chip
            size="small"
            label="Running"
            icon={<CircularProgress size={12} />}
            sx={{ bgcolor: 'rgba(33,150,243,0.15)', color: '#42a5f5' }}
          />
        );
      case 'done':
        return <Chip size="small" label="Done" sx={{ bgcolor: 'rgba(76,175,80,0.15)', color: '#66bb6a' }} />;
      case 'failed':
        return <Chip size="small" label="Failed" sx={{ bgcolor: 'rgba(244,67,54,0.15)', color: '#ef5350' }} />;
    }
  };

  // --- Profile editor ---
  const openNewProfile = () => {
    setEditingProfile(null);
    setProfileName('');
    setProfileContent('');
    setProfileDialogOpen(true);
  };

  const openEditProfile = (p: AgentProfile) => {
    setEditingProfile(p);
    setProfileName(p.name);
    setProfileContent(p.content);
    setProfileDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim() || !profileContent.trim()) return;
    setSaving(true);
    try {
      if (editingProfile) {
        await window.api.updateAgentProfile(editingProfile.id, {
          name: profileName.trim(),
          content: profileContent,
        });
      } else {
        const created = await window.api.createAgentProfile({
          name: profileName.trim(),
          content: profileContent,
        });
        setProfileId(created.id);
      }
      setProfileDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (id: number) => {
    await window.api.deleteAgentProfile(id);
    if (profileId === id) setProfileId('');
  };

  const handleToggleDatasetLink = async (dataset: Dataset) => {
    if (!editingProfile) return;
    const isLinked = linkedDatasets.some((d) => d.id === dataset.id);
    if (isLinked) {
      await window.api.unlinkProfileDataset(editingProfile.id, dataset.id);
    } else {
      await window.api.linkProfileDataset(editingProfile.id, dataset.id);
    }
  };

  // Group threads: parents first, children indented beneath
  const parentThreads = threads.filter((t) => !t.parent_thread_id);
  const childrenOf = (parentId: number) =>
    threads.filter((t) => t.parent_thread_id === parentId);

  const renderThread = (thread: AgentThread, isChild: boolean) => {
    const isExpanded = expandedThread === thread.id;
    const events = threadEvents[thread.id] ?? [];
    const hasEvents = events.length > 0;

    return (
      <Box
        key={thread.id}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          ml: isChild ? 2 : 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          onClick={() => setExpandedThread(isExpanded ? null : thread.id)}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {isChild ? '\u21B3 ' : ''}{thread.agent_name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {new Date(thread.created_at).toLocaleString()}
            </Typography>
          </Box>
          {statusChip(thread.status)}
          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>

        <Collapse in={isExpanded}>
          <Box
            ref={isExpanded ? outputRef : undefined}
            sx={{
              bgcolor: '#1a1a2e',
              color: '#e0e0e0',
              p: 1.5,
              m: 0,
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: 300,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            {hasEvents ? (
              renderEvents(events)
            ) : (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {thread.live_output || 'Waiting for output...'}
              </pre>
            )}
          </Box>

          {/* Follow-up chat input — show when thread is done and has a session */}
          {thread.status === 'done' && thread.session_id && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ px: 1, py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}
            >
              <TextField
                size="small"
                fullWidth
                placeholder="Ask a follow-up or say 'fix this'..."
                value={expandedThread === thread.id ? followUpMsg : ''}
                onChange={(e) => setFollowUpMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleFollowUp(thread);
                  }
                }}
                sx={{
                  '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 },
                }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleFollowUp(thread)}
                disabled={followUpLoading || !followUpMsg.trim()}
                sx={{ minWidth: 36 }}
              >
                {followUpLoading ? <CircularProgress size={14} /> : <SendIcon sx={{ fontSize: 16 }} />}
              </Button>
            </Stack>
          )}
        </Collapse>
      </Box>
    );
  };

  return (
    <>
      <Tooltip title="Agent Threads">
        <IconButton onClick={() => setOpen(!open)} size="small" color={open ? 'primary' : 'default'}>
          <SmartToyIcon />
        </IconButton>
      </Tooltip>

      <Drawer
        variant="persistent"
        anchor="right"
        open={open}
        sx={{
          width: open ? PANEL_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: PANEL_WIDTH,
            bgcolor: 'background.paper',
            borderLeft: '1px solid',
            borderColor: 'divider',
            top: 52, // below AppBar
            height: 'calc(100% - 52px)',
          },
        }}
      >
        <Box sx={{ p: 2, overflow: 'auto', height: '100%' }}>
          {/* New Thread Form */}
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            New Thread
          </Typography>

          <Stack spacing={1.5}>
            <FormControl size="small" fullWidth>
              <InputLabel>Dataset</InputLabel>
              <Select
                value={datasetId}
                label="Dataset"
                onChange={(e) => setDatasetId(e.target.value as number)}
              >
                {datasets.map((d) => (
                  <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={0.5} alignItems="center">
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Profile</InputLabel>
                <Select
                  value={profileId}
                  label="Profile"
                  onChange={(e) => setProfileId(e.target.value as number)}
                >
                  {profiles.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title="Manage Profiles">
                <IconButton size="small" onClick={() => setProfileDialogOpen(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            <TextField
              size="small"
              label="Agent Name"
              placeholder="Elliot, Cox, etc."
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              fullWidth
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Milestone</InputLabel>
              <Select
                value={milestoneId}
                label="Milestone"
                onChange={(e) => setMilestoneId(e.target.value as number)}
              >
                {milestones.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              onClick={handleStart}
              disabled={starting || !datasetId || !profileId || !agentName.trim() || !milestoneId}
              startIcon={starting ? <CircularProgress size={14} /> : <SmartToyIcon />}
            >
              {starting ? 'Starting...' : 'Start'}
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Thread List */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Threads ({threads.length})
          </Typography>

          {threads.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No threads yet
            </Typography>
          )}

          <Stack spacing={1}>
            {parentThreads.map((thread) => (
              <Box key={thread.id}>
                {renderThread(thread, false)}
                {childrenOf(thread.id).map((child) => renderThread(child, true))}
              </Box>
            ))}
          </Stack>
        </Box>
      </Drawer>

      {/* Profile Editor Dialog */}
      <Dialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingProfile ? `Edit Profile: ${editingProfile.name}` : profileName || profileContent ? 'New Profile' : 'Manage Profiles'}
        </DialogTitle>
        <DialogContent>
          {/* Show list when not actively editing/creating */}
          {!editingProfile && !profileName && !profileContent ? (
            <Box>
              <List dense>
                {profiles.map((p) => (
                  <ListItemButton key={p.id} onClick={() => openEditProfile(p)}>
                    <ListItemText
                      primary={p.name}
                      secondary={p.content.slice(0, 80) + (p.content.length > 80 ? '...' : '')}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItemButton>
                ))}
              </List>
              {profiles.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No profiles yet
                </Typography>
              )}
              <Button
                startIcon={<AddIcon />}
                onClick={openNewProfile}
                sx={{ mt: 1 }}
              >
                New Profile
              </Button>
            </Box>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Profile Name"
                size="small"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                fullWidth
                placeholder="e.g. mission-control-backend"
              />
              <TextField
                label="Content"
                multiline
                minRows={12}
                maxRows={24}
                value={profileContent}
                onChange={(e) => setProfileContent(e.target.value)}
                fullWidth
                placeholder="System prompt / review criteria for the agent..."
                sx={{
                  '& .MuiInputBase-root': {
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  },
                }}
              />
              {editingProfile && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Linked Repos
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Select which repos this profile can work with
                  </Typography>
                  {datasets.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No datasets available</Typography>
                  ) : (
                    <Stack>
                      {datasets.map((d) => (
                        <FormControlLabel
                          key={d.id}
                          control={
                            <Checkbox
                              size="small"
                              checked={linkedDatasets.some((ld) => ld.id === d.id)}
                              onChange={() => handleToggleDatasetLink(d)}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2">{d.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {d.repo_path}
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {(editingProfile || profileName || profileContent) ? (
            <>
              <Button onClick={() => {
                setEditingProfile(null);
                setProfileName('');
                setProfileContent('');
              }}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveProfile}
                disabled={saving || !profileName.trim() || !profileContent.trim()}
              >
                {saving ? 'Saving...' : editingProfile ? 'Save' : 'Create'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setProfileDialogOpen(false)}>Close</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AgentThreadPanel;
