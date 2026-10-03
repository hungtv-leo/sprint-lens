import type { CSSProperties } from 'react'

function parseHex(hex: string) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return null
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function withAlpha(hex: string, alpha: number) {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function relativeLuminance(hex: string) {
  const rgb = parseHex(hex)
  if (!rgb) return 0.5
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** Mix accent toward black for readable ink on pale tints */
function darkInk(hex: string, amount = 0.55) {
  const rgb = parseHex(hex)
  if (!rgb) return '#1F2937'
  return `rgb(${Math.round(rgb.r * (1 - amount))}, ${Math.round(rgb.g * (1 - amount))}, ${Math.round(rgb.b * (1 - amount))})`
}

/**
 * High-contrast accent tag.
 * Avoid Ant Design `color={hex}` — light accents get white text and become unreadable.
 */
export function accentTagStyle(accent: string, isDark: boolean): CSSProperties {
  const bright = relativeLuminance(accent) > 0.55

  if (isDark) {
    return {
      color: bright ? accent : '#F8FAFC',
      background: withAlpha(accent, bright ? 0.18 : 0.28),
      borderColor: withAlpha(accent, 0.55),
    }
  }

  return {
    color: bright ? darkInk(accent, 0.62) : darkInk(accent, 0.35),
    background: withAlpha(accent, 0.16),
    borderColor: withAlpha(accent, 0.42),
  }
}
