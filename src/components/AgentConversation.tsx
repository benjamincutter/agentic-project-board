import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  Stack,
  TextField,
  Button,
  Divider,
  CircularProgress,
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SendIcon from '@mui/icons-material/Send';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import GroupIcon from '@mui/icons-material/Group';
import AgentAvatar from './AgentAvatar';
import type { ThreadStreamEvent } from '../types';

interface Props {
  threadId: number;
  events: ThreadStreamEvent[];
  status: 'running' | 'done' | 'failed' | 'paused';
  sessionId: string | null;
  agentName?: string;
  agentAvatar?: string | null;
  onFollowUp?: (message: string) => void;
  onApproveDiff?: (commitMessage: string) => void;
  onRejectDiff?: (feedback: string) => void;
  onDelegateReview?: () => void;
}

const AgentConversation = ({
  threadId,
  events,
  status,
  sessionId,
  agentName,
  agentAvatar,
  onFollowUp,
  onApproveDiff,
  onRejectDiff,
  onDelegateReview,
}: Props) => {
  const [thinkingExpanded, setThinkingExpanded] = useState<Record<string, boolean>>({});
  const [toolResultExpanded, setToolResultExpanded] = useState<Record<string, boolean>>({});
  const [followUpMsg, setFollowUpMsg] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [events]);

  const handleFollowUp = async () => {
    if (!followUpMsg.trim() || followUpLoading || !onFollowUp) return;
    setFollowUpLoading(true);
    try {
      onFollowUp(followUpMsg.trim());
      setFollowUpMsg('');
    } finally {
      setFollowUpLoading(false);
    }
  };

  // Collapse consecutive thinking blocks into just the latest
  const collapseEvents = (evts: ThreadStreamEvent[]) => {
    const collapsed: { event: ThreadStreamEvent; idx: number }[] = [];
    for (let i = 0; i < evts.length; i++) {
      const event = evts[i];
      if (event.type === 'thinking') {
        if (i + 1 < evts.length && evts[i + 1].type === 'thinking') continue;
      }
      collapsed.push({ event, idx: i });
    }
    return collapsed;
  };

  const collapsed = collapseEvents(events);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Conversation stream */}
      <Box
        ref={outputRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: '#1a1a2e',
          color: '#e0e0e0',
          p: 2,
          fontFamily: 'monospace',
          fontSize: '0.8rem',
        }}
      >
        {/* Agent header */}
        {agentName && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <AgentAvatar avatar={agentAvatar} name={agentName} size={28} />
            <Typography variant="body2" fontWeight={600} sx={{ color: '#90caf9' }}>
              {agentName}
            </Typography>
            <Chip
              size="small"
              label={status}
              sx={{
                fontSize: '0.6rem',
                height: 18,
                bgcolor: status === 'running' ? 'rgba(33,150,243,0.15)'
                  : status === 'paused' ? 'rgba(255,167,38,0.15)'
                  : status === 'done' ? 'rgba(76,175,80,0.15)'
                  : 'rgba(244,67,54,0.15)',
                color: status === 'running' ? '#42a5f5'
                  : status === 'paused' ? '#ffa726'
                  : status === 'done' ? '#66bb6a'
                  : '#ef5350',
              }}
            />
          </Stack>
        )}

        {collapsed.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.5, fontStyle: 'italic' }}>
            Waiting for output...
          </Typography>
        ) : (
          collapsed.map(({ event, idx }) => {
            const key = `${threadId}-${idx}`;
            switch (event.type) {
              case 'thinking': {
                const isOpen = thinkingExpanded[key] ?? false;
                return (
                  <Box key={key} sx={{ mb: 0.5 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', opacity: 0.6 }}
                      onClick={() => setThinkingExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
                    >
                      <PsychologyIcon sx={{ fontSize: 16 }} />
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>thinking...</Typography>
                      {isOpen ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                    </Box>
                    <Collapse in={isOpen}>
                      <Typography
                        component="pre"
                        sx={{
                          fontStyle: 'italic',
                          opacity: 0.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          ml: 3,
                          mt: 0.5,
                        }}
                      >
                        {event.content}
                      </Typography>
                    </Collapse>
                  </Box>
                );
              }
              case 'text':
                return (
                  <Typography
                    key={key}
                    variant="body2"
                    component="span"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8rem' }}
                  >
                    {event.content}
                  </Typography>
                );
              case 'tool_use': {
                const inputSummary = event.input.file_path
                  ? String(event.input.file_path)
                  : event.input.pattern
                    ? String(event.input.pattern)
                    : event.input.command
                      ? String(event.input.command).slice(0, 80)
                      : '';
                return (
                  <Chip
                    key={key}
                    size="small"
                    icon={<BuildIcon sx={{ fontSize: '14px !important' }} />}
                    label={`${event.tool} ${inputSummary}`}
                    sx={{
                      my: 0.25,
                      maxWidth: '100%',
                      height: 'auto',
                      '& .MuiChip-label': {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '0.7rem',
                      },
                      bgcolor: 'rgba(33,150,243,0.1)',
                    }}
                  />
                );
              }
              case 'tool_result': {
                const isOpen = toolResultExpanded[key] ?? false;
                return (
                  <Box key={key} sx={{ mb: 0.25 }}>
                    <Typography
                      variant="caption"
                      sx={{ cursor: 'pointer', opacity: 0.5, fontSize: '0.65rem' }}
                      onClick={() => setToolResultExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
                    >
                      {isOpen ? '\u25BC' : '\u25B6'} result ({event.tool})
                    </Typography>
                    <Collapse in={isOpen}>
                      <Typography
                        component="pre"
                        sx={{
                          fontSize: '0.65rem',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: 200,
                          overflow: 'auto',
                          opacity: 0.6,
                          ml: 1,
                        }}
                      >
                        {event.output}
                      </Typography>
                    </Collapse>
                  </Box>
                );
              }
              case 'diff_ready': {
                return (
                  <Box
                    key={key}
                    sx={{
                      my: 2,
                      p: 2,
                      border: '1px solid',
                      borderColor: 'primary.main',
                      borderRadius: 1,
                      bgcolor: 'rgba(33,150,243,0.05)',
                    }}
                  >
                    <Divider sx={{ mb: 1.5 }}>
                      <Chip label="Diff Ready" color="primary" size="small" />
                    </Divider>
                    <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      {event.message || 'Changes ready for review'}
                    </Typography>

                    {/* Commit message edit */}
                    <TextField
                      size="small"
                      fullWidth
                      label="Commit message"
                      value={commitMessage || event.message}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      sx={{ mb: 1.5, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                    />

                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<ThumbUpIcon />}
                        onClick={() => onApproveDiff?.(commitMessage || event.message)}
                      >
                        Approve & Commit
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<ThumbDownIcon />}
                        onClick={() => setShowRejectInput(!showRejectInput)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<GroupIcon />}
                        onClick={() => onDelegateReview?.()}
                      >
                        Delegate to Reviewer
                      </Button>
                    </Stack>

                    <Collapse in={showRejectInput}>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Feedback for the agent..."
                          value={rejectFeedback}
                          onChange={(e) => setRejectFeedback(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && rejectFeedback.trim()) {
                              e.preventDefault();
                              onRejectDiff?.(rejectFeedback.trim());
                              setRejectFeedback('');
                              setShowRejectInput(false);
                            }
                          }}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          disabled={!rejectFeedback.trim()}
                          onClick={() => {
                            onRejectDiff?.(rejectFeedback.trim());
                            setRejectFeedback('');
                            setShowRejectInput(false);
                          }}
                        >
                          Send
                        </Button>
                      </Stack>
                    </Collapse>
                  </Box>
                );
              }
              case 'result': {
                const data = event.data as { verdict?: string; summary?: string } | null;
                if (!data?.verdict) return null;
                const isApproved = data.verdict === 'approve';
                return (
                  <Box key={key} sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {isApproved ? (
                      <CheckCircleIcon sx={{ fontSize: 18, color: '#66bb6a' }} />
                    ) : (
                      <ErrorIcon sx={{ fontSize: 18, color: '#ef5350' }} />
                    )}
                    <Chip
                      size="small"
                      label={isApproved ? 'Approved' : 'Changes Requested'}
                      sx={{
                        bgcolor: isApproved ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                        color: isApproved ? '#66bb6a' : '#ef5350',
                        fontWeight: 600,
                      }}
                    />
                    {data.summary && (
                      <Typography variant="body2" sx={{ ml: 0.5, opacity: 0.7 }}>
                        {data.summary}
                      </Typography>
                    )}
                  </Box>
                );
              }
              default:
                return null;
            }
          })
        )}
      </Box>

      {/* Follow-up input bar */}
      {status === 'done' && sessionId && onFollowUp && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            p: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder="Ask a follow-up..."
            value={followUpMsg}
            onChange={(e) => setFollowUpMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleFollowUp();
              }
            }}
            sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={handleFollowUp}
            disabled={followUpLoading || !followUpMsg.trim()}
            sx={{ minWidth: 40 }}
          >
            {followUpLoading ? <CircularProgress size={16} /> : <SendIcon sx={{ fontSize: 18 }} />}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default AgentConversation;
