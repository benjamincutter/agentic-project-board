import { SvgIcon, type SvgIconProps } from '@mui/material';

const SacredHeartLogo = (props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 100 100">
    {/* Heart shape */}
    <path
      d="M50 88 C25 65, 5 50, 5 32 C5 18, 16 8, 30 8 C38 8, 45 12, 50 20 C55 12, 62 8, 70 8 C84 8, 95 18, 95 32 C95 50, 75 65, 50 88Z"
      fill="#c62828"
      stroke="#e53935"
      strokeWidth="2"
    />
    {/* Cross */}
    <rect x="44" y="25" width="12" height="40" rx="2" fill="#fff" />
    <rect x="35" y="35" width="30" height="12" rx="2" fill="#fff" />
  </SvgIcon>
);

export default SacredHeartLogo;
