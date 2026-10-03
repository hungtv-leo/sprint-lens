/**
 * Sprint Lens — Galaxy Mist (light Milky Way)
 * Bright mist surfaces + nebula highlights (cyan / orchid / star gold)
 * Harmony: analogous cool cosmos + warm star accents (10%)
 */
export const palette = {
  // Cosmic blue / periwinkle (bright)
  primary700: '#4B5FD4',
  primary600: '#5A6DE0',
  primary500: '#6B7CFF',
  primary400: '#93A0FF',

  // Nebula cyan (highlight / in progress)
  aqua600: '#2EB8C9',
  aqua500: '#3DCFDE',
  aqua400: '#67E8F9',

  // Nebula orchid + star gold
  peach500: '#E879A9',
  gold500: '#D4B24A',

  success500: '#4ADEA8',
  danger500: '#F07178',
} as const

export const chartColors = [
  palette.primary500,
  palette.aqua400,
  palette.peach500,
  palette.gold500,
  palette.success500,
  palette.primary400,
  palette.aqua500,
  palette.danger500,
] as const

export const statAccents = {
  total: palette.primary500,
  unstarted: palette.gold500,
  testing: palette.aqua400,
  done: palette.success500,
} as const

export const lightSurfaces = {
  layout: '#FBFBFF',
  layoutAccent: '#F5F7FF',
  container: '#FFFFFF',
  elevated: '#FFFFFF',
  border: '#E6EAF8',
  sider: '#FFFFFF',
} as const

export const darkSurfaces = {
  layout: '#0B0E1A',
  layoutAccent: '#12162A',
  container: '#14182B',
  elevated: '#1B2038',
  border: '#2C3354',
  sider: '#101425',
} as const
