import { Card, Statistic, Typography, theme } from 'antd'

type StatCardProps = {
  label: string
  value: number
  hint?: string
  accent?: string
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function StatCard({ label, value, hint, accent }: StatCardProps) {
  const { token } = theme.useToken()
  const tone = accent ?? token.colorPrimary

  return (
    <Card
      styles={{
        body: {
          background: `linear-gradient(135deg, ${withAlpha(tone, 0.16)} 0%, ${withAlpha(tone, 0.04)} 55%, transparent 100%)`,
          borderLeft: `3px solid ${tone}`,
          borderRadius: token.borderRadiusLG,
          boxShadow: `inset 0 1px 0 ${withAlpha(tone, 0.2)}, 0 0 20px ${withAlpha(tone, 0.08)}`,
        },
      }}
    >
      <Statistic
        title={label}
        value={value}
        valueStyle={{
          color: tone,
          fontWeight: 600,
          textShadow: `0 0 18px ${withAlpha(tone, 0.35)}`,
        }}
      />
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {hint ?? 'Tổng hợp từ sprint đang xem'}
      </Typography.Text>
    </Card>
  )
}
