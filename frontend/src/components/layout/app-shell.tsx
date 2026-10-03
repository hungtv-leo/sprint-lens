import {
  AppstoreOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CustomerServiceOutlined,
  FileExcelOutlined,
  MenuOutlined,
  MoonOutlined,
  ProjectOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { Button, Drawer, Flex, Grid, Layout, Menu, Space, Switch, Typography, theme } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useThemeMode } from '../../theme/theme-provider'

const { Sider, Content, Header } = Layout
const { useBreakpoint } = Grid

const OVERVIEW_KEY = 'overview'
const KPI_KEY = 'kpi-module'
const OPS_KEY = 'ops-module'
const SIDEBAR_WIDTH = 260

const navigation: MenuProps['items'] = [
  {
    key: OVERVIEW_KEY,
    label: 'Tổng quan',
    icon: <AppstoreOutlined />,
    children: [
      { key: '/dashboard', label: 'Bảng tổng hợp', icon: <BarChartOutlined /> },
      { key: '/board', label: 'Bảng Kanban', icon: <ProjectOutlined /> },
      { key: '/weekly-report', label: 'Báo cáo tuần', icon: <CalendarOutlined /> },
    ],
  },
  {
    key: KPI_KEY,
    label: 'KPI',
    icon: <FileExcelOutlined />,
    children: [{ key: '/kpi', label: 'Tính toán & Xuất', icon: <FileExcelOutlined /> }],
  },
  {
    key: OPS_KEY,
    label: 'Vận hành',
    icon: <CustomerServiceOutlined />,
    children: [
      { key: '/ops/cases', label: 'Ghi nhận case', icon: <CustomerServiceOutlined /> },
    ],
  },
]

function SidebarBrand() {
  const { token } = theme.useToken()

  return (
    <div style={{ padding: '20px 24px 8px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorInfo})`,
            boxShadow: `0 0 0 3px ${token.colorPrimaryBg}, 0 0 12px ${token.colorPrimary}`,
          }}
        />
        <Typography.Text
          strong
          style={{
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: token.colorPrimary,
            textShadow: `0 0 18px ${token.colorPrimaryBg}`,
          }}
        >
          Sprint Lens
        </Typography.Text>
      </div>
      <Typography.Title level={4} style={{ marginTop: 8, marginBottom: 0 }}>
        Bảng điều khiển sprint Jira
      </Typography.Title>
    </div>
  )
}

function ThemeToggle() {
  const { mode, setMode } = useThemeMode()

  return (
    <div style={{ marginTop: 'auto', padding: '16px 24px 0' }}>
      <Space>
        <SunOutlined />
        <Switch
          checked={mode === 'dark'}
          onChange={(checked) => setMode(checked ? 'dark' : 'light')}
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<SunOutlined />}
        />
        <Typography.Text type="secondary">{mode === 'dark' ? 'Tối' : 'Sáng'}</Typography.Text>
      </Space>
    </div>
  )
}

function NavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      defaultOpenKeys={[OVERVIEW_KEY, KPI_KEY, OPS_KEY]}
      items={navigation}
      onClick={({ key }) => {
        if (key === OVERVIEW_KEY || key === KPI_KEY || key === OPS_KEY) return
        navigate(key)
        onNavigate?.()
      }}
      style={{ borderInlineEnd: 'none', marginTop: 8 }}
    />
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const screens = useBreakpoint()
  const isDesktop = Boolean(screens.lg)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { token } = theme.useToken()
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const siderStyle = {
    overflow: 'auto' as const,
    height: '100vh',
    position: 'sticky' as const,
    top: 0,
    insetInlineStart: 0,
    background: token.colorBgContainer,
    borderRight: `1px solid ${token.colorBorderSecondary}`,
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isDesktop ? (
        <Sider width={SIDEBAR_WIDTH} style={siderStyle}>
          <Flex vertical style={{ minHeight: '100%', paddingBottom: 24 }}>
            <SidebarBrand />
            <NavMenu />
            <ThemeToggle />
          </Flex>
        </Sider>
      ) : null}

      <Layout style={{ minWidth: 0 }}>
        {!isDesktop ? (
          <Header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingInline: 16,
              height: 56,
              lineHeight: '56px',
              background: token.colorBgContainer,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Space>
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
                aria-label="Mở menu"
              />
              <Typography.Text strong>Sprint Lens</Typography.Text>
            </Space>
            <ThemeToggleCompact />
          </Header>
        ) : null}

        <Content style={{ background: token.colorBgLayout, minWidth: 0, width: '100%' }}>
          {children}
        </Content>
      </Layout>

      <Drawer
        title="Sprint Lens"
        placement="left"
        width={Math.min(SIDEBAR_WIDTH + 20, 320)}
        open={!isDesktop && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
      >
        <Flex vertical style={{ minHeight: '100%', paddingBottom: 24 }}>
          <div style={{ padding: '8px 24px 0' }}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
              Quan sát sprint gọn gàng, ưu tiên đọc nhanh và ra quyết định.
            </Typography.Paragraph>
          </div>
          <NavMenu onNavigate={() => setDrawerOpen(false)} />
          <ThemeToggle />
        </Flex>
      </Drawer>
    </Layout>
  )
}

function ThemeToggleCompact() {
  const { mode, setMode } = useThemeMode()

  return (
    <Space size={8}>
      <Switch
        size="small"
        checked={mode === 'dark'}
        onChange={(checked) => setMode(checked ? 'dark' : 'light')}
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
      />
    </Space>
  )
}
