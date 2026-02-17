import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Paper, Typography, Chip, Box, LinearProgress } from '@mui/material';
import type { Milestone } from '../types';

export type FlowNodeData = {
  milestone: Milestone;
  tasksDone: number;
  tasksTotal: number;
};

const statusColors: Record<string, string> = {
  not_started: '#666',
  in_progress: '#ff9800',
  done: '#4caf50',
};

const FlowNode = ({ data }: NodeProps) => {
  const { milestone, tasksDone, tasksTotal } = data as unknown as FlowNodeData;
  const progress = tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0;

  return (
    <Paper
      elevation={2}
      sx={{
        p: 1.5,
        minWidth: 180,
        border: '2px solid',
        borderColor: statusColors[milestone.status],
        bgcolor: 'background.paper',
      }}
    >
      <Handle type="target" position={Position.Left} />

      <Typography variant="subtitle2" fontWeight={600} noWrap>
        {milestone.name}
      </Typography>

      <Box display="flex" gap={0.5} mt={0.5} mb={0.5}>
        <Chip
          label={milestone.status.replace('_', ' ')}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.65rem',
            bgcolor: statusColors[milestone.status],
            color: '#fff',
          }}
        />
        {milestone.owner && (
          <Chip
            label={milestone.owner}
            size="small"
            variant="outlined"
            sx={{ height: 18, fontSize: '0.65rem' }}
          />
        )}
      </Box>

      {tasksTotal > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            {tasksDone}/{tasksTotal} tasks
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 3, borderRadius: 2, mt: 0.5 }}
          />
        </Box>
      )}

      <Handle type="source" position={Position.Right} />
    </Paper>
  );
};

export default FlowNode;
