import { Card, Statistic, Typography } from 'antd'

type StatCardProps = {
  label: string
  value: number
  hint?: string
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card>
      <Statistic title={label} value={value} />
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {hint ?? 'Tổng hợp từ sprint đang xem'}
      </Typography.Text>
    </Card>
  )
}
