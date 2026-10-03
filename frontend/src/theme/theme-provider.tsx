import { createContext, useContext, useEffect, useMemo } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import type { ThemeConfig } from 'antd'
import viVN from 'antd/locale/vi_VN'

import { useLocalStorage } from '../hooks/use-local-storage'
import { darkSurfaces, lightSurfaces, palette } from './palette'

export type ThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function buildTheme(mode: ThemeMode): ThemeConfig {
  const isDark = mode === 'dark'
  const surfaces = isDark ? darkSurfaces : lightSurfaces
  const primary = isDark ? palette.primary400 : palette.primary500
  const primaryStrong = isDark ? palette.primary400 : palette.primary700

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorInfo: isDark ? palette.aqua400 : palette.aqua500,
      colorSuccess: palette.success500,
      colorWarning: palette.gold500,
      colorError: palette.danger500,
      colorLink: primaryStrong,
      colorBgLayout: surfaces.layout,
      colorBgContainer: surfaces.container,
      colorBgElevated: surfaces.elevated,
      colorBorder: surfaces.border,
      colorBorderSecondary: isDark ? '#252B48' : '#E4E9FB',
      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 8,
      fontFamily:
        '"Segoe UI Variable", "Segoe UI", "Noto Sans", system-ui, -apple-system, sans-serif',
      fontSize: 14,
      controlHeight: 36,
      boxShadow: isDark
        ? '0 8px 28px rgba(107, 124, 255, 0.16)'
        : '0 8px 28px rgba(107, 124, 255, 0.1)',
      boxShadowSecondary: isDark
        ? '0 4px 14px rgba(0, 0, 0, 0.3)'
        : '0 4px 14px rgba(107, 124, 255, 0.06)',
    },
    components: {
      Layout: {
        siderBg: surfaces.sider,
        headerBg: surfaces.container,
        bodyBg: surfaces.layout,
      },
      Menu: {
        itemBorderRadius: 10,
        itemMarginInline: 10,
        itemSelectedBg: isDark ? 'rgba(147, 160, 255, 0.18)' : 'rgba(107, 124, 255, 0.12)',
        itemSelectedColor: primaryStrong,
        itemHoverBg: isDark ? 'rgba(147, 160, 255, 0.1)' : 'rgba(107, 124, 255, 0.07)',
      },
      Card: {
        headerBg: 'transparent',
      },
      Button: {
        primaryShadow: isDark
          ? '0 0 16px rgba(147, 160, 255, 0.35)'
          : '0 0 14px rgba(107, 124, 255, 0.35)',
      },
      Tag: {
        defaultBg: isDark ? 'rgba(147, 160, 255, 0.14)' : 'rgba(107, 124, 255, 0.1)',
        defaultColor: primaryStrong,
      },
    },
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useLocalStorage<ThemeMode>('sprint-lens.theme', 'light')

  useEffect(() => {
    const surfaces = mode === 'dark' ? darkSurfaces : lightSurfaces
    document.documentElement.dataset.theme = mode
    document.documentElement.lang = 'vi'
    document.documentElement.style.setProperty('--sl-bg-layout', surfaces.layout)
    document.documentElement.style.setProperty('--sl-bg-accent', surfaces.layoutAccent)
    document.documentElement.style.setProperty(
      '--sl-primary',
      mode === 'dark' ? palette.primary400 : palette.primary500,
    )
    document.documentElement.style.setProperty('--sl-aqua', palette.aqua400)
    document.documentElement.style.setProperty('--sl-orchid', palette.peach500)
    document.documentElement.style.setProperty('--sl-gold', palette.gold500)
    document.body.style.backgroundColor = surfaces.layout
  }, [mode])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode(mode === 'light' ? 'dark' : 'light'),
    }),
    [mode, setMode],
  )

  const themeConfig = useMemo(() => buildTheme(mode), [mode])

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider locale={viVN} theme={themeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

export function useThemeMode() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider')
  }
  return context
}
