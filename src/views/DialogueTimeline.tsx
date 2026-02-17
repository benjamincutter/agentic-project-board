import { useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { useMilestones, useAllDialogue } from '../hooks/useDatabase';
import FilterBar from '../components/FilterBar';
import DialogueEntryComponent from '../components/DialogueEntry';

interface DialogueTimelineProps {
  projectId: number;
}

const DialogueTimeline = ({ projectId }: DialogueTimelineProps) => {
  const milestones = useMilestones(projectId);
  const entries = useAllDialogue(projectId, 200);

  const [filterMilestone, setFilterMilestone] = useState<number | 'all'>('all');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const authors = [...new Set(entries.map((e) => e.author))];

  const filtered = entries.filter((e) => {
    if (filterMilestone !== 'all' && e.milestone_id !== filterMilestone) return false;
    if (filterAuthor !== 'all' && e.author !== filterAuthor) return false;
    if (filterType !== 'all' && e.entry_type !== filterType) return false;
    return true;
  });

  return (
    <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
      <FilterBar
        milestones={milestones}
        selectedMilestone={filterMilestone}
        onMilestoneChange={setFilterMilestone}
        selectedAuthor={filterAuthor}
        onAuthorChange={setFilterAuthor}
        selectedType={filterType}
        onTypeChange={setFilterType}
        authors={authors}
      />

      <Stack spacing={1.5}>
        {filtered.map((entry) => (
          <DialogueEntryComponent key={entry.id} entry={entry} showMilestone />
        ))}
        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
            No dialogue entries match the current filters
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default DialogueTimeline;
