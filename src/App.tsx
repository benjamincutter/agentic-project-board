import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import TerminalIcon from '@mui/icons-material/Terminal';
import InfoIcon from '@mui/icons-material/Info';
import NavTabs from './components/NavTabs';
import ProjectSelector from './components/ProjectSelector';
import UserBadge from './components/UserBadge';
import BroadcastDialog from './components/BroadcastDialog';
import AgentThreadPanel from './components/AgentThreadPanel';
import ManageAgentsDialog from './components/ManageAgentsDialog';
import ManageReposDialog from './components/ManageReposDialog';
import SacredHeartLogo from './components/SacredHeartLogo';
import KanbanBoard from './views/KanbanBoard';
import DependencyFlow from './views/DependencyFlow';
import DialogueTimeline from './views/DialogueTimeline';
import AgentIDE from './views/AgentIDE';
import { useDefaultProject, useMilestones } from './hooks/useDatabase';
import type { Project } from './types';

const App = () => {
  const [tab, setTab] = useState(0);
  const defaultProject = useDefaultProject();
  const [project, setProject] = useState<Project | null>(null);
  const milestones = useMilestones(project?.id);

  // Logo menu state
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [manageAgentsOpen, setManageAgentsOpen] = useState(false);
  const [manageReposOpen, setManageReposOpen] = useState(false);

  useEffect(() => {
    if (defaultProject && !project) setProject(defaultProject);
  }, [defaultProject, project]);

  if (!project) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar variant="dense" sx={{ minHeight: 52, gap: 1.5 }}>
          {/* Logo + Branding — clickable for menu */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              mr: 1,
              cursor: 'pointer',
              borderRadius: 1,
              px: 0.5,
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <SacredHeartLogo sx={{ fontSize: 28, color: '#c62828' }} />
            <Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.secondary',
                  fontStyle: 'italic',
                  lineHeight: 1,
                  display: 'block',
                }}
              >
                I can't do this all on my own. I'm no superman.
              </Typography>
            </Box>
          </Stack>

          {/* Logo dropdown menu */}
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
              paper: {
                sx: { minWidth: 220, mt: 0.5 },
              },
            }}
          >
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setManageAgentsOpen(true);
              }}
            >
              <ListItemIcon>
                <SmartToyIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Manage Agents</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setManageReposOpen(true);
              }}
            >
              <ListItemIcon>
                <StorageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Manage Repos</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                setTab(3);
              }}
            >
              <ListItemIcon>
                <TerminalIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Agent IDE</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem disabled>
              <ListItemIcon>
                <InfoIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Sacred Heart"
                secondary="v0.1.0"
              />
            </MenuItem>
          </Menu>

          {/* Project Selector */}
          <ProjectSelector currentProject={project} onProjectChange={setProject} />

          {/* Agent Threads + Broadcast */}
          <AgentThreadPanel projectId={project.id} milestones={milestones} />
          <BroadcastDialog milestones={milestones} projectId={project.id} />

          {/* Tabs (centered) */}
          <Box sx={{ flex: 1 }}>
            <NavTabs value={tab} onChange={setTab} />
          </Box>

          {/* User Badge (right) */}
          <UserBadge />
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {tab === 0 && <KanbanBoard projectId={project.id} />}
        {tab === 1 && <DependencyFlow projectId={project.id} />}
        {tab === 2 && <DialogueTimeline projectId={project.id} />}
        {tab === 3 && <AgentIDE projectId={project.id} />}
      </Box>

      {/* Manage Agents Dialog */}
      <ManageAgentsDialog open={manageAgentsOpen} onClose={() => setManageAgentsOpen(false)} />
      <ManageReposDialog open={manageReposOpen} onClose={() => setManageReposOpen(false)} />
    </Box>
  );
};

export default App;
