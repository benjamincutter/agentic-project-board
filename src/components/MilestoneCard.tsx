import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  LinearProgress,
  Box,
  Stack,
} from '@mui/material';
import type { Milestone, Task } from '../types';

const statusColors: Record<string, 'default' | 'warning' | 'success'> = {
  not_started: 'default',
  in_progress: 'warning',
  done: 'success',
};

interface MilestoneCardProps {
  milestone: Milestone;
  tasks: Task[];
  onClick: () => void;
}

const MilestoneCard = ({ milestone, tasks, onClick }: MilestoneCardProps) => {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <Card
      sx={{
        mb: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
              {milestone.name}
            </Typography>
            <Chip
              label={`P${milestone.priority}`}
              size="small"
              color={milestone.priority === 0 ? 'error' : 'default'}
              sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
            />
          </Stack>

          {milestone.owner && (
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              {milestone.owner}
            </Typography>
          )}

          <Chip
            label={milestone.status.replace('_', ' ')}
            size="small"
            color={statusColors[milestone.status]}
            sx={{ mb: 1, height: 20, fontSize: '0.7rem' }}
          />

          {total > 0 && (
            <Box>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Tasks
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {done}/{total}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 4, borderRadius: 2 }}
              />
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default MilestoneCard;
