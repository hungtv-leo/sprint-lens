import { Grid } from 'antd'
import type { CSSProperties, ReactNode } from 'react'

const { useBreakpoint } = Grid

export function PageBody({ children }: { children: ReactNode }) {
  const screens = useBreakpoint()
  const style: CSSProperties = {
    padding: !screens.sm ? 12 : !screens.lg ? 16 : 24,
    display: 'flex',
    flexDirection: 'column',
    gap: !screens.md ? 12 : 16,
    minWidth: 0,
    width: '100%',
  }

  return <div style={style}>{children}</div>
}
