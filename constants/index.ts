export const THEME = {
  bg: '#0A120E',
  bgSecondary: '#0F1A14',
  surface: '#152620',
  surfaceElevated: '#1C3329',
  border: '#243D32',
  borderLight: '#2D4A3E',

  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryMuted: '#14532D',
  primaryGlow: 'rgba(34, 197, 94, 0.15)',

  text: '#ECFDF5',
  textSecondary: '#A7C4B5',
  textMuted: '#6B9080',

  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  dangerBorder: 'rgba(239, 68, 68, 0.35)',

  success: '#4ADE80',
  successBg: 'rgba(74, 222, 128, 0.12)',
  successBorder: 'rgba(74, 222, 128, 0.3)',

  warning: '#FBBF24',
  info: '#38BDF8',
  infoBg: 'rgba(56, 189, 248, 0.12)',

  drawerActive: '#1A3D2E',
  drawerActiveBorder: '#22C55E',
};

export const GAS_THRESHOLD = 400;

export const COLORS = {
  primary: THEME.primary,
  primaryDark: THEME.primaryDark,
  primaryLight: THEME.primaryGlow,
  danger: THEME.danger,
  dangerDark: THEME.dangerDark,
  dangerLight: THEME.dangerBg,
  success: THEME.success,
  successDark: THEME.primaryDark,
  successLight: THEME.successBg,
  info: THEME.info,
  infoDark: '#0284C7',
  infoLight: THEME.infoBg,
};

export const APP_NAME = 'GasSafer';
export const USSD_CODE = '*801*1560#';

export const EMERGENCY_CONTACTS = [
  { label: 'Primary contact', number: '+250780838274', tel: 'tel:+250780838274' },
  { label: 'Fire & rescue', number: '112', tel: 'tel:112' },
  { label: 'Police', number: '113', tel: 'tel:113' },
];
