import { Stack, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import type { Milestone } from '../types';

interface FilterBarProps {
  milestones: Milestone[];
  selectedMilestone: number | 'all';
  onMilestoneChange: (value: number | 'all') => void;
  selectedAuthor: string;
  onAuthorChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  authors: string[];
}

const FilterBar = ({
  milestones,
  selectedMilestone,
  onMilestoneChange,
  selectedAuthor,
  onAuthorChange,
  selectedType,
  onTypeChange,
  authors,
}: FilterBarProps) => (
  <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel>Milestone</InputLabel>
      <Select
        value={selectedMilestone}
        label="Milestone"
        onChange={(e) => onMilestoneChange(e.target.value as number | 'all')}
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
      <InputLabel>Author</InputLabel>
      <Select value={selectedAuthor} label="Author" onChange={(e) => onAuthorChange(e.target.value)}>
        <MenuItem value="all">All Authors</MenuItem>
        {authors.map((a) => (
          <MenuItem key={a} value={a}>
            {a}
          </MenuItem>
        ))}
      </Select>
    </FormControl>

    <FormControl size="small" sx={{ minWidth: 120 }}>
      <InputLabel>Type</InputLabel>
      <Select value={selectedType} label="Type" onChange={(e) => onTypeChange(e.target.value)}>
        <MenuItem value="all">All Types</MenuItem>
        <MenuItem value="decision">Decision</MenuItem>
        <MenuItem value="progress">Progress</MenuItem>
        <MenuItem value="blocker">Blocker</MenuItem>
        <MenuItem value="note">Note</MenuItem>
      </Select>
    </FormControl>
  </Stack>
);

export default FilterBar;
