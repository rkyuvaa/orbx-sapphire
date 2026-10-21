/**
 * OrbX Sapphire Design Tokens
 * Theme: Dark Emerald & Clean Slate
 */

export const ORBX_THEME = {
  name: 'Dark Emerald & Clean Slate',
  fonts: {
    sans: "'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    brand: "'Comfortaa', cursive",
  },
  typography: {
    h1: { fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 },
    h2: { fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25 },
    h3: { fontSize: '1.60rem', fontWeight: 600, lineHeight: 1.3 },
    h4: { fontSize: '1.40rem', fontWeight: 600, lineHeight: 1.35 },
    h5: { fontSize: '1.20rem', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '1.00rem', fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.4 },
    button: { fontSize: '0.85rem', fontWeight: 600, textTransform: 'none' },
    caption: { fontSize: '0.75rem', lineHeight: 1.3 },
  },
  dimensions: {
    topbarHeight: 48,
    sidebarWidthExpanded: 240,
    sidebarWidthCollapsed: 64,
  },
  borderRadius: {
    cards: 14,
    dialogModals: 16,
    buttons: 8,
    inputs: 8,
    badges: 6,
    default: 12,
  },
  colors: {
    dark: {
      accent: '#16C47F',
      accentLight: '#3ae09d',
      accentDark: '#0b965f',
      accentContrast: '#0A1712',
      secondaryBrand: '#1e4d36',
      bgDefault: '#0A1712',
      bgPaper: '#0F211A',
      bgSurface2: '#142A21',
      border: 'rgba(255, 255, 255, 0.09)',
      textPrimary: '#E6F0EC',
      textSecondary: 'rgba(230, 240, 236, 0.70)',
      textDisabled: 'rgba(230, 240, 236, 0.38)',
      authGradient: 'linear-gradient(135deg, #0b1c15 0%, #1b4332 100%)',
    },
    light: {
      accent: '#16C47F',
      accentLight: '#0f9e64',
      accentDark: '#0c8052',
      accentContrast: '#FFFFFF',
      secondaryBrand: '#2d6a4f',
      bgDefault: '#F4F6F5',
      bgPaper: '#FFFFFF',
      bgSurface2: '#E8ECE9',
      border: 'rgba(0, 0, 0, 0.08)',
      textPrimary: '#0E1F18',
      textSecondary: '#475569',
      textDisabled: '#94A3B8',
      authGradient: 'linear-gradient(135deg, #0b1c15 0%, #1b4332 100%)',
    },
    semantic: {
      success: '#16C47F',
      error: '#ff5252',
      warning: '#ffab40',
      info: '#29b6f6',
    },
  },
  shadows: {
    cardDark: '0 4px 20px rgba(0, 0, 0, 0.25)',
    cardDarkHover: '0 8px 32px rgba(0, 0, 0, 0.40)',
    cardLight: '0 4px 12px rgba(0, 0, 0, 0.03)',
    cardLightHover: '0 8px 24px rgba(0, 0, 0, 0.08)',
    modalDark: '0 16px 48px rgba(0, 0, 0, 0.60)',
    primaryButton: '0 2px 8px rgba(22, 196, 127, 0.25)',
    primaryButtonHover: '0 4px 16px rgba(22, 196, 127, 0.40)',
  },
} as const;

export type OrbxThemeTokens = typeof ORBX_THEME;
