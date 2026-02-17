import { useState } from 'react';
import {
  Select,
  MenuItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { Project } from '../types';
import { useProjects } from '../hooks/useDatabase';

interface ProjectSelectorProps {
  currentProject: Project;
  onProjectChange: (project: Project) => void;
}

const CREATE_NEW = '__create_new__';

const ProjectSelector = ({ currentProject, onProjectChange }: ProjectSelectorProps) => {
  const projects = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleChange = (value: string) => {
    if (value === CREATE_NEW) {
      setDialogOpen(true);
      return;
    }
    const project = projects.find((p) => String(p.id) === value);
    if (project) onProjectChange(project);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const project = await window.api.createProject({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
    });
    setDialogOpen(false);
    setNewName('');
    setNewDescription('');
    onProjectChange(project);
  };

  return (
    <>
      <Select
        value={String(currentProject.id)}
        onChange={(e) => handleChange(e.target.value)}
        size="small"
        variant="outlined"
        sx={{
          fontWeight: 700,
          fontSize: '0.95rem',
          '.MuiSelect-select': { py: 0.5 },
          minWidth: 180,
        }}
      >
        {projects.map((p) => (
          <MenuItem key={p.id} value={String(p.id)}>
            <ListItemText primary={p.name} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value={CREATE_NEW}>
          <AddIcon sx={{ mr: 1, fontSize: '1rem' }} />
          <ListItemText primary="New Project" />
        </MenuItem>
      </Select>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Project Name"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Description (optional)"
            fullWidth
            multiline
            rows={2}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProjectSelector;
