import { ReloadOutlined } from '@ant-design/icons'
import { Button, Flex, Grid, Typography, theme } from 'antd'

const { useBreakpoint } = Grid

type TopBarProps = {
  title: string
  description: string
  onRefresh?: () => void
  refreshing?: boolean
}

export function TopBar({
  title,
  description,
  onRefresh,
  refreshing = false,
}: TopBarProps) {
  const { token } = theme.useToken()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  return (
    <Flex
      justify="space-between"
      align={isMobile ? 'flex-start' : 'flex-end'}
      vertical={isMobile}
      wrap="wrap"
      gap={16}
      style={{
        padding: isMobile ? '16px' : '20px 24px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <Typography.Text type="secondary">Góc nhìn sprint</Typography.Text>
        <Typography.Title
          level={isMobile ? 3 : 2}
          style={{ marginTop: 8, marginBottom: 8, wordBreak: 'break-word' }}
        >
          {title}
        </Typography.Title>
        <Typography.Paragraph
          type="secondary"
          style={{ marginBottom: 0, maxWidth: 640 }}
          ellipsis={isMobile ? { rows: 2 } : false}
        >
          {description}
        </Typography.Paragraph>
      </div>

      <Button
        block={isMobile}
        icon={<ReloadOutlined spin={refreshing} />}
        onClick={onRefresh}
        loading={refreshing}
      >
        Làm mới
      </Button>
    </Flex>
  )
}
