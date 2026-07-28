import { Card, Empty, Grid, Typography, theme } from 'antd'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const { useBreakpoint } = Grid

type AssigneeChartProps = {
  data: Array<{
    assignee: string
    total: number
  }>
}

export function AssigneeChart({ data }: AssigneeChartProps) {
  const { token } = theme.useToken()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const chartHeight = isMobile ? 240 : 300

  return (
    <Card
      size={isMobile ? 'small' : 'default'}
      title="Khối lượng theo người được giao"
      extra={<Typography.Text type="secondary">Top {data.length}</Typography.Text>}
      style={{ height: '100%' }}
    >
      {!isMobile ? (
        <Typography.Paragraph type="secondary">
          Giúp nhìn nhanh ai đang quá tải trong sprint.
        </Typography.Paragraph>
      ) : null}
      {data.length === 0 ? (
        <Empty description="Chưa có dữ liệu người được giao." />
      ) : (
        <div style={{ height: chartHeight, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={token.colorBorderSecondary} vertical={false} />
              <XAxis
                dataKey="assignee"
                stroke={token.colorTextSecondary}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={isMobile ? -30 : -15}
                height={isMobile ? 80 : 70}
                textAnchor="end"
                tick={{ fontSize: isMobile ? 11 : 12 }}
              />
              <YAxis
                stroke={token.colorTextSecondary}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={isMobile ? 28 : 40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: token.colorBgElevated,
                  borderColor: token.colorBorderSecondary,
                  borderRadius: 8,
                  color: token.colorText,
                }}
              />
              <Bar dataKey="total" fill={token.colorPrimary} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
