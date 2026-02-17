import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Divider,
  TextField,
  Button,
  Box,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import type { Milestone, Task, DialogueEntry } from '../types';
import { useDialogue, useTasks } from '../hooks/useDatabase';
import DialogueEntryComponent from './DialogueEntry';
import { getUsername } from './UserBadge';

interface MilestoneDetailProps {
  milestone: Milestone;
  onClose: () => void;
}

const MilestoneDetail = ({ milestone, onClose }: MilestoneDetailProps) => {
  const tasks = useTasks(milestone.id);
  const dialogue = useDialogue(milestone.id);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<DialogueEntry['entry_type']>('note');

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    await window.api.updateTask(task.id, { status: newStatus });
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await window.api.createTask({ milestone_id: milestone.id, title: newTaskTitle.trim() });
    setNewTaskTitle('');
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await window.api.createDialogue({
      milestone_id: milestone.id,
      author: getUsername() || 'Human',
      entry_type: noteType,
      content: newNote.trim(),
    });
    setNewNote('');
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6">{milestone.name}</Typography>
          <Chip label={`P${milestone.priority}`} size="small" />
          <Chip label={milestone.status.replace('_', ' ')} size="small" color="warning" />
          {milestone.owner && <Chip label={milestone.owner} size="small" variant="outlined" />}
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {milestone.description && (
          <Box sx={{ mb: 2, '& p': { m: 0 } }}>
            <ReactMarkdown>{milestone.description}</ReactMarkdown>
          </Box>
        )}

        {/* Tasks */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Tasks ({tasks.filter((t) => t.status === 'done').length}/{tasks.length})
        </Typography>

        <List dense disablePadding>
          {tasks.map((task) => (
            <ListItem key={task.id} disablePadding>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox
                  edge="start"
                  checked={task.status === 'done'}
                  onChange={() => handleToggleTask(task)}
                  size="small"
                />
              </ListItemIcon>
              <ListItemText
                primary={task.title}
                secondary={task.assignee}
                sx={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}
              />
            </ListItem>
          ))}
        </List>

        <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 3 }}>
          <TextField
            size="small"
            placeholder="Add task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            fullWidth
          />
          <Button variant="outlined" size="small" onClick={handleAddTask}>
            Add
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Dialogue */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Dialogue
        </Typography>

        <Stack spacing={1} sx={{ mb: 2 }}>
          {dialogue.map((entry) => (
            <DialogueEntryComponent key={entry.id} entry={entry} />
          ))}
          {dialogue.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No dialogue yet
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={noteType}
              label="Type"
              onChange={(e) => setNoteType(e.target.value as DialogueEntry['entry_type'])}
            >
              <MenuItem value="note">Note</MenuItem>
              <MenuItem value="decision">Decision</MenuItem>
              <MenuItem value="progress">Progress</MenuItem>
              <MenuItem value="blocker">Blocker</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Add dialogue entry..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            fullWidth
            multiline
            maxRows={3}
          />
          <Button variant="outlined" size="small" onClick={handleAddNote}>
            Log
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default MilestoneDetail;
