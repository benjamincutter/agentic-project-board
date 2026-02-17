import { Tabs, Tab, Box } from '@mui/material';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ForumIcon from '@mui/icons-material/Forum';

interface NavTabsProps {
  value: number;
  onChange: (value: number) => void;
}

const NavTabs = ({ value, onChange }: NavTabsProps) => (
  <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
    <Tabs value={value} onChange={(_, v) => onChange(v)}>
      <Tab icon={<ViewKanbanIcon />} label="Board" iconPosition="start" />
      <Tab icon={<AccountTreeIcon />} label="Dependencies" iconPosition="start" />
      <Tab icon={<ForumIcon />} label="Dialogue" iconPosition="start" />
    </Tabs>
  </Box>
);

export default NavTabs;
