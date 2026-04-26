/**
 * TruckFlowUS brand colors — matches the web app's Tailwind theme.
 */
export const colors = {
  // Primary navy
  navy: {
    50: '#F0F4F8',
    100: '#D9E2EC',
    200: '#BCCCDC',
    300: '#9FB3C8',
    400: '#7B8FA8',
    500: '#5A7189',
    600: '#3E556B',
    700: '#2D3F50',
    800: '#1E3A5F',
    900: '#102A43',
  },
  // Safety orange (accent)
  safety: {
    400: '#FF9F1C',
    500: '#FF8C00',
    600: '#E07800',
  },
  // Steel (neutral gray)
  steel: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  // Status colors
  status: {
    green: '#22C55E',
    greenBg: '#DCFCE7',
    red: '#EF4444',
    redBg: '#FEE2E2',
    yellow: '#EAB308',
    yellowBg: '#FEF9C3',
    blue: '#3B82F6',
    blueBg: '#DBEAFE',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;
