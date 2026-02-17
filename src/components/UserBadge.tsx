import { useState, useEffect } from 'react';
import {
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Avatar,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

const STORAGE_KEY = 'agentic-board-username';

export const getUsername = (): string => {
  return localStorage.getItem(STORAGE_KEY) || '';
};

const UserBadge = () => {
  const [username, setUsername] = useState(getUsername);
  const [dialogOpen, setDialogOpen] = useState(!username);
  const [editValue, setEditValue] = useState(username);

  useEffect(() => {
    if (!username) setDialogOpen(true);
  }, [username]);

  const handleSave = () => {
    if (!editValue.trim()) return;
    const name = editValue.trim();
    localStorage.setItem(STORAGE_KEY, name);
    setUsername(name);
    setDialogOpen(false);
  };

  return (
    <>
      <Chip
        avatar={
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <PersonIcon sx={{ fontSize: 16 }} />
          </Avatar>
        }
        label={username || 'Set name'}
        variant="outlined"
        onClick={() => {
          setEditValue(username);
          setDialogOpen(true);
        }}
        sx={{ cursor: 'pointer' }}
      />

      <Dialog open={dialogOpen} onClose={() => username && setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{username ? 'Change Display Name' : 'Welcome! What should we call you?'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Your Name"
            fullWidth
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="e.g. Ben"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          {username && <Button onClick={() => setDialogOpen(false)}>Cancel</Button>}
          <Button variant="contained" onClick={handleSave} disabled={!editValue.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UserBadge;
