import { Avatar, type SxProps, type Theme } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';

interface Props {
  avatar: string | null | undefined;
  name: string;
  size?: number;
  sx?: SxProps<Theme>;
}

const AgentAvatar = ({ avatar, name, size = 32, sx }: Props) => {
  if (avatar) {
    return (
      <Avatar
        src={avatar}
        alt={name}
        sx={{ width: size, height: size, ...sx }}
      />
    );
  }

  // Fallback: colored avatar with initial
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = ['#c62828', '#ad1457', '#6a1b9a', '#283593', '#0277bd', '#00695c', '#2e7d32', '#e65100'];
  const bg = colors[hash % colors.length];

  return (
    <Avatar sx={{ width: size, height: size, bgcolor: bg, fontSize: size * 0.45, ...sx }}>
      {name.charAt(0).toUpperCase()}
    </Avatar>
  );
};

export default AgentAvatar;
