import { useState, useEffect } from 'react';
import { Box, Typography, AppBar, Toolbar, Stack } from '@mui/material';
import NavTabs from './components/NavTabs';
import ProjectSelector from './components/ProjectSelector';
import UserBadge from './components/UserBadge';
import BroadcastDialog from './components/BroadcastDialog';
import SacredHeartLogo from './components/SacredHeartLogo';
import KanbanBoard from './views/KanbanBoard';
import DependencyFlow from './views/DependencyFlow';
import DialogueTimeline from './views/DialogueTimeline';
import { useDefaultProject, useMilestones } from './hooks/useDatabase';
import type { Project } from './types';

const App = () => {
  const [tab, setTab] = useState(0);
  const defaultProject = useDefaultProject();
  const [project, setProject] = useState<Project | null>(null);
  const milestones = useMilestones(project?.id);

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
          {/* Logo + Branding */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mr: 1 }}>
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

          {/* Project Selector */}
          <ProjectSelector currentProject={project} onProjectChange={setProject} />

          {/* Broadcast */}
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
      </Box>
    </Box>
  );
};

export default App;
