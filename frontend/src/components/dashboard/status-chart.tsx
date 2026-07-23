import { Card, Flex, Grid, Space, Typography, theme } from 'antd'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const { useBreakpoint } = Grid

type StatusChartProps = {
  data: Array<{
    status_name: string
    total: number
  }>
}

const COLORS = ['#1677ff', '#722ed1', '#52c41a', '#faad14', '#f5222d', '#13c2c2']

export function StatusChart({ data }: StatusChartProps) {
  const { token } = theme.useToken()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const chartHeight = isMobile ? 220 : 300
  const total = data.reduce((sum, item) => sum + item.total, 0)

  return (
    <Card
      size={isMobile ? 'small' : 'default'}
      title="Phân bổ theo trạng thái"
      extra={<Typography.Text type="secondary">{total} task</Typography.Text>}
      style={{ height: '100%' }}
    >
      {!isMobile ? (
        <Typography.Paragraph type="secondary">
          Nhanh chóng nhìn sprint đang tắc ở đâu.
        </Typography.Paragraph>
      ) : null}
      <Flex gap={16} wrap="wrap" vertical={isMobile}>
        <div style={{ flex: 1, minWidth: isMobile ? '100%' : 240, height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="status_name"
                innerRadius={isMobile ? 48 : 68}
                outerRadius={isMobile ? 78 : 102}
                paddingAngle={4}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.status_name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: token.colorBgElevated,
                  borderColor: token.colorBorderSecondary,
                  borderRadius: 8,
                  color: token.colorText,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <Space direction="vertical" style={{ minWidth: isMobile ? '100%' : 180 }} size="small">
          {data.map((item, index) => (
            <Flex key={item.status_name} justify="space-between" gap={16}>
              <Space>
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
                <Typography.Text>{item.status_name}</Typography.Text>
              </Space>
              <Typography.Text strong>{item.total}</Typography.Text>
            </Flex>
          ))}
        </Space>
      </Flex>
    </Card>
  )
}
