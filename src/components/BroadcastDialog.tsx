import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import type { Milestone } from '../types';
import { getUsername } from './UserBadge';

interface BroadcastDialogProps {
  milestones: Milestone[];
  projectId: number;
}

const BroadcastDialog = ({ milestones, projectId }: BroadcastDialogProps) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [entryType, setEntryType] = useState<string>('note');
  const [targetMilestone, setTargetMilestone] = useState<number | 'all'>('all');

  const handleSend = async () => {
    if (!content.trim()) return;
    const author = getUsername() || 'Human';

    if (targetMilestone === 'all') {
      // Broadcast to all milestones in the project
      for (const m of milestones) {
        await window.api.createDialogue({
          milestone_id: m.id,
          author,
          entry_type: entryType,
          content: content.trim(),
        });
      }
    } else {
      await window.api.createDialogue({
        milestone_id: targetMilestone,
        author,
        entry_type: entryType,
        content: content.trim(),
      });
    }

    setContent('');
    setOpen(false);
  };

  return (
    <>
      <Tooltip title="Broadcast message">
        <IconButton onClick={() => setOpen(true)} size="small" color="primary">
          <CampaignIcon />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Broadcast Message</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Target</InputLabel>
                <Select
                  value={targetMilestone}
                  label="Target"
                  onChange={(e) => setTargetMilestone(e.target.value as number | 'all')}
                >
                  <MenuItem value="all">All Milestones</MenuItem>
                  {milestones.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={entryType}
                  label="Type"
                  onChange={(e) => setEntryType(e.target.value)}
                >
                  <MenuItem value="note">Note</MenuItem>
                  <MenuItem value="decision">Decision</MenuItem>
                  <MenuItem value="progress">Progress</MenuItem>
                  <MenuItem value="blocker">Blocker</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <TextField
              autoFocus
              label="Message"
              fullWidth
              multiline
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Your message (markdown supported)..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSend} disabled={!content.trim()}>
            {targetMilestone === 'all' ? `Send to All (${milestones.length})` : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BroadcastDialog;
