import { useState, useEffect } from 'react';
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
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Tooltip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Dataset } from '../types';
import { useDatasets } from '../hooks/useDatabase';

interface Props {
  open: boolean;
  onClose: () => void;
}

type View = 'list' | 'edit';

const ManageReposDialog = ({ open, onClose }: Props) => {
  const datasets = useDatasets();

  const [view, setView] = useState<View>('list');
  const [selectedRepo, setSelectedRepo] = useState<Dataset | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Editor state
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setView('list');
      setSelectedRepo(null);
    }
  }, [open]);

  const openEditor = (repo: Dataset | null) => {
    if (repo) {
      setSelectedRepo(repo);
      setEditName(repo.name);
      setEditPath(repo.repo_path);
      setEditDescription(repo.description ?? '');
      setIsNew(false);
    } else {
      setSelectedRepo(null);
      setEditName('');
      setEditPath('');
      setEditDescription('');
      setIsNew(true);
    }
    setView('edit');
  };

  const handleSave = async () => {
    if (!editName.trim() || !editPath.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await window.api.createDataset({
          name: editName.trim(),
          repo_path: editPath.trim(),
          description: editDescription.trim() || undefined,
        });
      } else if (selectedRepo) {
        await window.api.updateDataset(selectedRepo.id, {
          name: editName.trim(),
          repo_path: editPath.trim(),
          description: editDescription.trim() || null,
        });
      }
      setView('list');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (repo: Dataset) => {
    await window.api.deleteDataset(repo.id);
    if (selectedRepo?.id === repo.id) {
      setView('list');
      setSelectedRepo(null);
    }
  };

  const renderList = () => (
    <>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderIcon />
        Manage Repos
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => openEditor(null)}>
          Add Repo
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        {datasets.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <FolderIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography color="text.secondary">No repos registered</Typography>
            <Typography variant="caption" color="text.secondary">
              Register a local git repo to link it with agent profiles
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {datasets.map((repo) => (
              <ListItemButton
                key={repo.id}
                onClick={() => openEditor(repo)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&:hover .action-buttons': { opacity: 1 },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <FolderIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body1" fontWeight={600}>
                      {repo.name}
                    </Typography>
                  }
                  secondary={
                    <Stack spacing={0.25}>
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem', opacity: 0.7 }}
                      >
                        {repo.repo_path}
                      </Typography>
                      {repo.description && (
                        <Typography variant="caption" color="text.secondary">
                          {repo.description}
                        </Typography>
                      )}
                    </Stack>
                  }
                />
                <ListItemSecondaryAction className="action-buttons" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(repo); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </>
  );

  const renderEdit = () => (
    <>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setView('list')}>
          <ArrowBackIcon />
        </IconButton>
        {isNew ? 'Add Repo' : `Edit: ${selectedRepo?.name}`}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Name"
            size="small"
            fullWidth
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="e.g. mission-control"
          />
          <TextField
            label="Repo Path"
            size="small"
            fullWidth
            value={editPath}
            onChange={(e) => setEditPath(e.target.value)}
            placeholder="/path/to/your/repo"
            sx={{
              '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' },
            }}
            helperText="Absolute path to the local git repository"
          />
          <TextField
            label="Description (optional)"
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="What is this repo for?"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setView('list')}>Back</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !editName.trim() || !editPath.trim()}
        >
          {saving ? 'Saving...' : isNew ? 'Add' : 'Save'}
        </Button>
      </DialogActions>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      {view === 'list' && renderList()}
      {view === 'edit' && renderEdit()}
    </Dialog>
  );
};

export default ManageReposDialog;
