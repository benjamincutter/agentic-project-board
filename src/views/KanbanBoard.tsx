import { useState } from 'react';
import { Box, Typography, Paper, Stack } from '@mui/material';
import type { Milestone, Task } from '../types';
import { useMilestones, useTasksByProject } from '../hooks/useDatabase';
import MilestoneCard from '../components/MilestoneCard';
import MilestoneDetail from '../components/MilestoneDetail';

const columns: { key: Milestone['status']; label: string }[] = [
  { key: 'not_started', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

interface KanbanBoardProps {
  projectId: number;
}

const KanbanBoard = ({ projectId }: KanbanBoardProps) => {
  const milestones = useMilestones(projectId);
  const tasks = useTasksByProject(projectId);
  const [selected, setSelected] = useState<Milestone | null>(null);

  const tasksByMilestone = (milestoneId: number): Task[] =>
    tasks.filter((t) => t.milestone_id === milestoneId);

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" spacing={2} sx={{ minHeight: 'calc(100vh - 140px)' }}>
        {columns.map((col) => {
          const items = milestones.filter((m) => m.status === col.key);
          return (
            <Paper
              key={col.key}
              sx={{
                flex: 1,
                p: 2,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={700}
                color="text.secondary"
                textTransform="uppercase"
                letterSpacing={1}
                mb={2}
              >
                {col.label} ({items.length})
              </Typography>

              {items.map((milestone) => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  tasks={tasksByMilestone(milestone.id)}
                  onClick={() => setSelected(milestone)}
                />
              ))}
            </Paper>
          );
        })}
      </Stack>

      {selected && <MilestoneDetail milestone={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
};

export default KanbanBoard;
