import { Box, Typography, Chip, Stack } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'deleted';
}

interface Props {
  files: FileChange[];
  selectedFile: string | null;
  onSelectFile: (filename: string) => void;
}

const statusIcon = (status: FileChange['status']) => {
  switch (status) {
    case 'added':
      return <AddIcon sx={{ fontSize: 14, color: '#66bb6a' }} />;
    case 'modified':
      return <EditIcon sx={{ fontSize: 14, color: '#ffa726' }} />;
    case 'deleted':
      return <DeleteIcon sx={{ fontSize: 14, color: '#ef5350' }} />;
  }
};

const statusColor = (status: FileChange['status']) => {
  switch (status) {
    case 'added': return '#66bb6a';
    case 'modified': return '#ffa726';
    case 'deleted': return '#ef5350';
  }
};

const DiffFileTree = ({ files, selectedFile, onSelectFile }: Props) => (
  <Box sx={{ overflow: 'auto' }}>
    <Typography variant="caption" sx={{ px: 1, py: 0.5, display: 'block', opacity: 0.6 }}>
      {files.length} file{files.length !== 1 ? 's' : ''} changed
    </Typography>
    <Stack spacing={0}>
      {files.map((file) => (
        <Box
          key={file.filename}
          onClick={() => onSelectFile(file.filename)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.5,
            cursor: 'pointer',
            bgcolor: selectedFile === file.filename ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
            borderLeft: selectedFile === file.filename
              ? `2px solid ${statusColor(file.status)}`
              : '2px solid transparent',
          }}
        >
          {statusIcon(file.status)}
          <InsertDriveFileIcon sx={{ fontSize: 14, opacity: 0.5 }} />
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file.filename}
          </Typography>
        </Box>
      ))}
    </Stack>
  </Box>
);

export default DiffFileTree;
