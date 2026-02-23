import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Stack,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Collapse,
  Paper,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MemoryIcon from '@mui/icons-material/Psychology';
import PreviewIcon from '@mui/icons-material/Visibility';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import AgentAvatar from './AgentAvatar';
import type { AgentProfile, Dataset } from '../types';
import { useAgentProfiles, useDatasets, useProfileDatasets } from '../hooks/useDatabase';

interface Memory {
  id: number;
  profile_id: number;
  content: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// Rough token estimate: ~4 chars per token for English text
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const formatTokenCount = (count: number) => {
  if (count >= 1000) return `~${(count / 1000).toFixed(1)}k`;
  return `~${count}`;
};

// Estimate cost at Sonnet 4.5 input pricing ($3/MTok)
const estimateCost = (tokens: number) => {
  const costPerMTok = 3.0;
  return (tokens / 1_000_000) * costPerMTok;
};

type View = 'list' | 'edit' | 'preview';

const ManageAgentsDialog = ({ open, onClose }: Props) => {
  const allProfiles = useAgentProfiles();
  const datasets = useDatasets();

  // View state
  const [view, setView] = useState<View>('list');
  const [selectedProfile, setSelectedProfile] = useState<AgentProfile | null>(null);

  // Editor state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('coder');
  const [editContent, setEditContent] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // Memories state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesExpanded, setMemoriesExpanded] = useState(false);
  const [newMemory, setNewMemory] = useState('');

  // Linked datasets
  const linkedDatasets = useProfileDatasets(selectedProfile?.id);

  // Reset view when dialog opens/closes
  useEffect(() => {
    if (open) {
      setView('list');
      setSelectedProfile(null);
    }
  }, [open]);

  // Load memories when a profile is selected
  useEffect(() => {
    if (selectedProfile) {
      window.api.getAgentMemories(selectedProfile.id).then(setMemories);
    } else {
      setMemories([]);
    }
  }, [selectedProfile]);

  const openEditor = (profile: AgentProfile | null) => {
    if (profile) {
      setSelectedProfile(profile);
      setEditName(profile.name);
      setEditType(profile.agent_type);
      setEditContent(profile.content);
      setEditAvatar(profile.avatar);
      setIsNew(false);
    } else {
      setSelectedProfile(null);
      setEditName('');
      setEditType('coder');
      setEditContent('');
      setEditAvatar(null);
      setIsNew(true);
    }
    setMemoriesExpanded(false);
    setView('edit');
  };

  const openPreview = (profile: AgentProfile) => {
    setSelectedProfile(profile);
    setView('preview');
  };

  const handleSave = async () => {
    if (!editName.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await window.api.createAgentProfile({
          name: editName.trim(),
          agent_type: editType,
          content: editContent,
        });
        if (editAvatar) {
          await window.api.updateAgentProfile(created.id, { avatar: editAvatar });
        }
        setSelectedProfile(created);
        setIsNew(false);
      } else if (selectedProfile) {
        await window.api.updateAgentProfile(selectedProfile.id, {
          name: editName.trim(),
          agent_type: editType,
          content: editContent,
          avatar: editAvatar,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limit to 500KB
    if (file.size > 500_000) {
      alert('Image must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (profile: AgentProfile) => {
    await window.api.deleteAgentProfile(profile.id);
    if (selectedProfile?.id === profile.id) {
      setView('list');
      setSelectedProfile(null);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemory.trim() || !selectedProfile) return;
    const memory = await window.api.addAgentMemory(selectedProfile.id, newMemory.trim());
    setMemories((prev) => [...prev, memory]);
    setNewMemory('');
  };

  const handleDeleteMemory = async (id: number) => {
    await window.api.deleteAgentMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (profile: AgentProfile) => {
    const mems = await window.api.getAgentMemories(profile.id);
    const payload = {
      name: profile.name,
      agent_type: profile.agent_type,
      content: profile.content,
      avatar: profile.avatar,
      memories: mems.map((m: Memory) => ({ content: m.content, created_at: m.created_at })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.agent.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.name || !data.content) {
        alert('Invalid agent file: missing name or content');
        return;
      }
      const created = await window.api.createAgentProfile({
        name: data.name,
        agent_type: data.agent_type || 'coder',
        content: data.content,
      });
      if (data.avatar) {
        await window.api.updateAgentProfile(created.id, { avatar: data.avatar });
      }
      if (Array.isArray(data.memories)) {
        for (const mem of data.memories) {
          if (mem.content) {
            await window.api.addAgentMemory(created.id, mem.content);
          }
        }
      }
    } catch (err) {
      alert(`Failed to import agent: ${err instanceof Error ? err.message : err}`);
    }
    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  const handleToggleDataset = async (datasetId: number) => {
    if (!selectedProfile) return;
    const isLinked = linkedDatasets.some((d) => d.id === datasetId);
    if (isLinked) {
      await window.api.unlinkProfileDataset(selectedProfile.id, datasetId);
    } else {
      await window.api.linkProfileDataset(selectedProfile.id, datasetId);
    }
  };

  // Build the full prompt preview (profile + memories)
  const buildFullPrompt = () => {
    if (!selectedProfile) return '';
    let prompt = selectedProfile.content;
    if (memories.length > 0) {
      prompt += '\n\n---\n\n## Memories\n\n' + memories.map((m) => `- ${m.content}`).join('\n') + '\n';
    }
    return prompt;
  };

  // --- LIST VIEW ---
  const renderList = () => (
    <>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SmartToyIcon />
        Manage Agents
        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={<FileUploadIcon />}
          variant="outlined"
          size="small"
          onClick={() => importInputRef.current?.click()}
        >
          Import
        </Button>
        <input
          ref={importInputRef}
          type="file"
          hidden
          accept=".json"
          onChange={handleImport}
        />
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => openEditor(null)}>
          New Agent
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        {allProfiles.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <SmartToyIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography color="text.secondary">No agent profiles yet</Typography>
            <Typography variant="caption" color="text.secondary">
              Create one or add profile.md files to ~/.claude/agents/
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {allProfiles.map((profile) => (
              <ProfileListItem
                key={profile.id}
                profile={profile}
                onEdit={() => openEditor(profile)}
                onPreview={() => openPreview(profile)}
                onExport={() => handleExport(profile)}
                onDelete={() => handleDelete(profile)}
              />
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </>
  );

  // --- EDIT VIEW ---
  const renderEdit = () => (
    <>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setView('list')}>
          <ArrowBackIcon />
        </IconButton>
        {isNew ? 'New Agent' : `Edit: ${selectedProfile?.name}`}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Avatar upload */}
            <Box sx={{ position: 'relative' }}>
              <AgentAvatar avatar={editAvatar} name={editName || '?'} size={56} />
              <IconButton
                size="small"
                component="label"
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  width: 24,
                  height: 24,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <PhotoCameraIcon sx={{ fontSize: 14 }} />
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleAvatarUpload}
                />
              </IconButton>
            </Box>
            <Stack spacing={1} sx={{ flex: 1 }}>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Name"
                  size="small"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  sx={{ flex: 2 }}
                  placeholder="e.g. Dr. Cox"
                />
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Type</InputLabel>
                  <Select value={editType} label="Type" onChange={(e) => setEditType(e.target.value)}>
                    <MenuItem value="coder">Coder</MenuItem>
                    <MenuItem value="reviewer">Reviewer</MenuItem>
                    <MenuItem value="pm">PM</MenuItem>
                    <MenuItem value="qa">QA</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              {editAvatar && (
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  onClick={() => setEditAvatar(null)}
                  sx={{ alignSelf: 'flex-start', fontSize: '0.7rem', py: 0 }}
                >
                  Remove avatar
                </Button>
              )}
            </Stack>
          </Stack>

          <TextField
            label="Profile Content"
            multiline
            minRows={14}
            maxRows={24}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            fullWidth
            placeholder="System prompt / profile markdown..."
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '0.8rem',
              },
            }}
          />

          {/* Token estimate for content */}
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
            Profile: {formatTokenCount(estimateTokens(editContent))} tokens
            {memories.length > 0 && (
              <> + Memories: {formatTokenCount(estimateTokens(memories.map((m) => m.content).join('\n')))} tokens</>
            )}
          </Typography>

          {/* Linked Repos */}
          {!isNew && selectedProfile && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Linked Repos</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {datasets.map((d) => {
                  const isLinked = linkedDatasets.some((ld) => ld.id === d.id);
                  return (
                    <Chip
                      key={d.id}
                      size="small"
                      label={d.name}
                      variant={isLinked ? 'filled' : 'outlined'}
                      color={isLinked ? 'primary' : 'default'}
                      onClick={() => handleToggleDataset(d.id)}
                      sx={{ fontSize: '0.7rem' }}
                    />
                  );
                })}
                {datasets.length === 0 && (
                  <Typography variant="caption" color="text.secondary">No datasets available</Typography>
                )}
              </Stack>
            </Box>
          )}

          {/* Memories section */}
          {!isNew && selectedProfile && (
            <Box>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
                onClick={() => setMemoriesExpanded(!memoriesExpanded)}
              >
                <MemoryIcon sx={{ fontSize: 18 }} />
                <Typography variant="subtitle2">
                  Memories ({memories.length})
                </Typography>
                {memoriesExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
              </Box>
              <Collapse in={memoriesExpanded}>
                <Box sx={{ mt: 1, pl: 1 }}>
                  {memories.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      No memories yet. Memories are added during agent sessions.
                    </Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {memories.map((m) => (
                        <Box
                          key={m.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 0.5,
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: 'rgba(255,255,255,0.03)',
                            '&:hover .delete-btn': { opacity: 1 },
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ flex: 1, fontSize: '0.75rem', fontFamily: 'monospace' }}
                          >
                            {m.content}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontSize: '0.6rem' }}>
                            {new Date(m.created_at).toLocaleDateString()}
                          </Typography>
                          <IconButton
                            size="small"
                            className="delete-btn"
                            sx={{ opacity: 0, transition: 'opacity 0.2s', p: 0.25 }}
                            onClick={() => handleDeleteMemory(m.id)}
                          >
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Add a memory..."
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddMemory();
                        }
                      }}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                    />
                    <Button size="small" variant="outlined" disabled={!newMemory.trim()} onClick={handleAddMemory}>
                      Add
                    </Button>
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setView('list')}>Back</Button>
        {!isNew && selectedProfile && (
          <Button
            size="small"
            startIcon={<PreviewIcon />}
            onClick={() => openPreview(selectedProfile)}
          >
            Preview Prompt
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !editName.trim() || !editContent.trim()}
        >
          {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </>
  );

  // --- PREVIEW VIEW ---
  const renderPreview = () => {
    const fullPrompt = buildFullPrompt();
    const tokens = estimateTokens(fullPrompt);
    const cost = estimateCost(tokens);

    return (
      <>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setView(isNew ? 'list' : 'edit')}>
            <ArrowBackIcon />
          </IconButton>
          Prompt Preview: {selectedProfile?.name}
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={`${formatTokenCount(tokens)} tokens`}
              sx={{ bgcolor: 'rgba(144,202,249,0.15)', color: '#90caf9' }}
            />
            <Chip
              size="small"
              label={`$${cost.toFixed(4)} input`}
              sx={{ bgcolor: 'rgba(206,147,216,0.15)', color: '#ce93d8' }}
            />
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              bgcolor: '#1a1a2e',
              color: '#e0e0e0',
              maxHeight: '60vh',
              overflow: 'auto',
              lineHeight: 1.6,
            }}
          >
            {fullPrompt}
          </Paper>
          <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Profile</Typography>
              <Typography variant="body2">
                {formatTokenCount(estimateTokens(selectedProfile?.content ?? ''))} tokens
              </Typography>
            </Box>
            {memories.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">Memories ({memories.length})</Typography>
                <Typography variant="body2">
                  {formatTokenCount(estimateTokens(memories.map((m) => m.content).join('\n')))} tokens
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">Total</Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatTokenCount(tokens)} tokens / ${cost.toFixed(4)}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setView('edit')}>Back to Edit</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: '80vh' } }}
    >
      {view === 'list' && renderList()}
      {view === 'edit' && renderEdit()}
      {view === 'preview' && renderPreview()}
    </Dialog>
  );
};

// --- Profile list item sub-component ---
const ProfileListItem = ({
  profile,
  onEdit,
  onPreview,
  onExport,
  onDelete,
}: {
  profile: AgentProfile;
  onEdit: () => void;
  onPreview: () => void;
  onExport: () => void;
  onDelete: () => void;
}) => {
  // Extract first line after frontmatter for description
  const descriptionMatch = profile.content.match(/^description:\s*"?(.+?)"?\s*$/m);
  const description = descriptionMatch?.[1] ?? profile.agent_type;

  const typeColor = (type: string) => {
    switch (type) {
      case 'coder': return { bgcolor: 'rgba(76,175,80,0.12)', color: '#66bb6a' };
      case 'reviewer': return { bgcolor: 'rgba(33,150,243,0.12)', color: '#42a5f5' };
      case 'pm': return { bgcolor: 'rgba(255,167,38,0.12)', color: '#ffa726' };
      case 'qa': return { bgcolor: 'rgba(206,147,216,0.12)', color: '#ce93d8' };
      default: return { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.secondary' };
    }
  };

  return (
    <ListItemButton
      onClick={onEdit}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        '&:hover .action-buttons': { opacity: 1 },
      }}
    >
      <ListItemIcon sx={{ minWidth: 48 }}>
        <AgentAvatar avatar={profile.avatar} name={profile.name} size={36} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body1" fontWeight={600}>
              {profile.name}
            </Typography>
            <Chip
              size="small"
              label={profile.agent_type}
              sx={{ ...typeColor(profile.agent_type), fontSize: '0.65rem', height: 20 }}
            />
          </Stack>
        }
        secondary={description}
      />
      <ListItemSecondaryAction className="action-buttons" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
        <Tooltip title="Preview prompt">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onPreview(); }}>
            <PreviewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Export as JSON">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onExport(); }}>
            <FileDownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItemButton>
  );
};

export default ManageAgentsDialog;
