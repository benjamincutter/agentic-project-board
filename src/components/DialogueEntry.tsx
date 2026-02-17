import { Paper, Typography, Chip, Stack, Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import type { DialogueEntry as DialogueEntryType } from '../types';

const typeColors: Record<string, 'error' | 'info' | 'warning' | 'default'> = {
  decision: 'info',
  progress: 'default',
  blocker: 'error',
  note: 'default',
};

const typeBorders: Record<string, string> = {
  decision: '#90caf9',
  blocker: '#f44336',
  progress: '#4caf50',
  note: 'transparent',
};

interface DialogueEntryProps {
  entry: DialogueEntryType;
  showMilestone?: boolean;
}

const DialogueEntryComponent = ({ entry, showMilestone }: DialogueEntryProps) => {
  const isCallout = entry.entry_type === 'decision' || entry.entry_type === 'blocker';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderLeft: isCallout ? `3px solid ${typeBorders[entry.entry_type]}` : undefined,
        bgcolor: isCallout ? 'action.hover' : undefined,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
        <Typography variant="caption" fontWeight={600}>
          {entry.author}
        </Typography>
        <Chip
          label={entry.entry_type}
          size="small"
          color={typeColors[entry.entry_type]}
          sx={{ height: 18, fontSize: '0.65rem' }}
        />
        {showMilestone && entry.milestone_name && (
          <Chip
            label={entry.milestone_name}
            size="small"
            variant="outlined"
            sx={{ height: 18, fontSize: '0.65rem' }}
          />
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {new Date(entry.created_at).toLocaleString()}
        </Typography>
      </Stack>
      <Box sx={{ '& p': { m: 0 }, '& p:last-child': { mb: 0 }, fontSize: '0.875rem' }}>
        <ReactMarkdown>{entry.content}</ReactMarkdown>
      </Box>
    </Paper>
  );
};

export default DialogueEntryComponent;
