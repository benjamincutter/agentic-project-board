import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import GroupIcon from '@mui/icons-material/Group';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import DiffFileTree from './DiffFileTree';

interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'deleted';
}

interface Props {
  diff: string;
  commitMessage: string;
  onApprove: (commitMessage: string) => void;
  onReject: (feedback: string) => void;
  onDelegate: () => void;
  onClose: () => void;
}

// Parse unified diff to extract file list
const parseFiles = (diff: string): FileChange[] => {
  const files: FileChange[] = [];
  const lines = diff.split('\n');
  for (const line of lines) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)/);
    if (match) {
      const filename = match[2];
      // Determine status from subsequent lines
      const idx = lines.indexOf(line);
      let status: FileChange['status'] = 'modified';
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        if (lines[i].startsWith('new file')) {
          status = 'added';
          break;
        }
        if (lines[i].startsWith('deleted file')) {
          status = 'deleted';
          break;
        }
      }
      files.push({ filename, status });
    }
  }
  return files;
};

// Split diff into per-file sections
const splitDiffByFile = (diff: string): Record<string, string> => {
  const sections: Record<string, string> = {};
  const parts = diff.split(/(?=^diff --git )/m);
  for (const part of parts) {
    const match = part.match(/^diff --git a\/(.+) b\/(.+)/);
    if (match) {
      sections[match[2]] = part;
    }
  }
  return sections;
};

const DiffReviewPanel = ({ diff, commitMessage: initialCommitMessage, onApprove, onReject, onDelegate, onClose }: Props) => {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState(initialCommitMessage);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const diffContentRef = useRef<HTMLDivElement>(null);

  const files = parseFiles(diff);
  const fileSections = splitDiffByFile(diff);

  // Auto-select first file
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      setSelectedFile(files[0].filename);
    }
  }, [files, selectedFile]);

  const handleSelectFile = (filename: string) => {
    setSelectedFile(filename);
    // Scroll to file's diff section
    if (diffContentRef.current) {
      const el = diffContentRef.current.querySelector(`[data-file="${filename}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Render diff with syntax highlighting
  const renderDiffLine = (line: string, idx: number) => {
    let bgcolor = 'transparent';
    let color = '#e0e0e0';
    if (line.startsWith('+') && !line.startsWith('+++')) {
      bgcolor = 'rgba(76,175,80,0.1)';
      color = '#a5d6a7';
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      bgcolor = 'rgba(244,67,54,0.1)';
      color = '#ef9a9a';
    } else if (line.startsWith('@@')) {
      bgcolor = 'rgba(33,150,243,0.08)';
      color = '#90caf9';
    } else if (line.startsWith('diff --git')) {
      bgcolor = 'rgba(255,255,255,0.03)';
      color = '#b0bec5';
    }

    return (
      <Box
        key={idx}
        sx={{
          bgcolor,
          px: 1,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: '1.6',
          whiteSpace: 'pre',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color,
          borderLeft: line.startsWith('+') && !line.startsWith('+++')
            ? '3px solid rgba(76,175,80,0.5)'
            : line.startsWith('-') && !line.startsWith('---')
              ? '3px solid rgba(244,67,54,0.5)'
              : '3px solid transparent',
        }}
      >
        {line || ' '}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid', borderColor: 'divider' }}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Diff Review
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75 } }}
        >
          <ToggleButton value="unified">
            <Tooltip title="Unified view">
              <ViewStreamIcon sx={{ fontSize: 16 }} />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="split">
            <Tooltip title="Split view">
              <ViewColumnIcon sx={{ fontSize: 16 }} />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      {/* File tree */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', maxHeight: 200, overflow: 'auto' }}>
        <DiffFileTree
          files={files}
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
        />
      </Box>

      {/* Diff content */}
      <Box
        ref={diffContentRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: '#1a1a2e',
          color: '#e0e0e0',
        }}
      >
        {selectedFile && fileSections[selectedFile] ? (
          <Box data-file={selectedFile}>
            {fileSections[selectedFile].split('\n').map((line, idx) => renderDiffLine(line, idx))}
          </Box>
        ) : (
          // Show all files
          Object.entries(fileSections).map(([filename, section]) => (
            <Box key={filename} data-file={filename} sx={{ mb: 1 }}>
              <Box sx={{
                px: 1,
                py: 0.5,
                bgcolor: 'rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {filename}
                </Typography>
              </Box>
              {section.split('\n').map((line, idx) => renderDiffLine(line, idx))}
            </Box>
          ))
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <TextField
          size="small"
          fullWidth
          label="Commit message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
        />
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<ThumbUpIcon />}
            onClick={() => onApprove(commitMessage)}
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
            Revert All
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<GroupIcon />}
            onClick={onDelegate}
          >
            Delegate
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
                  onReject(rejectFeedback.trim());
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
                onReject(rejectFeedback.trim());
                setRejectFeedback('');
                setShowRejectInput(false);
              }}
            >
              Send
            </Button>
          </Stack>
        </Collapse>
      </Box>
    </Box>
  );
};

export default DiffReviewPanel;
