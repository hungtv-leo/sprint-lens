import { Badge, Card, Col, Empty, Grid, Row, Typography, theme } from 'antd'

import type { JiraIssue, JiraStatus } from '../../lib/types'
import { palette } from '../../theme/palette'
import { IssueCard } from './issue-card'

function categoryAccent(categoryName: string) {
  const value = categoryName.toLowerCase()
  if (value.includes('done') || value.includes('complete')) return palette.success500
  if (value.includes('progress') || value.includes('indeterminate')) return palette.aqua500
  if (value.includes('new') || value.includes('todo')) return palette.gold500
  return palette.primary500
}

const { useBreakpoint } = Grid

type KanbanBoardProps = {
  statuses: JiraStatus[]
  issues: JiraIssue[]
}

export function KanbanBoard({ statuses, issues }: KanbanBoardProps) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const isTablet = Boolean(screens.md) && !screens.xl

  const bodyHeight = isMobile ? 360 : isTablet ? 420 : 480
  const columnWidth = isMobile ? 280 : undefined

  const grouped = statuses.map((status) => ({
    ...status,
    items: issues.filter((issue) => issue.status_id === status.id),
  }))

  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
        }}
      >
        {grouped.map((column) => (
          <div
            key={column.id}
            style={{
              width: columnWidth,
              minWidth: columnWidth,
              scrollSnapAlign: 'start',
            }}
          >
            <KanbanColumn column={column} bodyHeight={bodyHeight} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <Row gutter={[16, 16]} align="stretch">
      {grouped.map((column) => (
        <Col
          key={column.id}
          xs={24}
          sm={12}
          lg={8}
          xl={6}
          style={{ display: 'flex' }}
        >
          <KanbanColumn column={column} bodyHeight={bodyHeight} />
        </Col>
      ))}
    </Row>
  )
}

type ColumnData = {
  id: string
  name: string
  category_name: string
  items: JiraIssue[]
}

function KanbanColumn({
  column,
  bodyHeight,
}: {
  column: ColumnData
  bodyHeight: number
}) {
  const { token } = theme.useToken()
  const accent = categoryAccent(column.category_name)

  return (
    <Card
      size="small"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: `3px solid ${accent}`,
      }}
      styles={{
        header: {
          background: `linear-gradient(180deg, ${accent}18 0%, transparent 100%)`,
        },
        body: {
          height: bodyHeight,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          background: token.colorBgContainer,
        },
      }}
      title={
        <div style={{ minWidth: 0 }}>
          <Typography.Text style={{ fontSize: 12, color: accent, fontWeight: 600 }}>
            {column.category_name}
          </Typography.Text>
          <div style={{ wordBreak: 'break-word' }}>{column.name}</div>
        </div>
      }
      extra={<Badge count={column.items.length} showZero color={accent} />}
    >
      {column.items.length === 0 ? (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Empty description="Không có task." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {column.items.map((issue) => (
            <IssueCard key={issue.key} issue={issue} />
          ))}
        </div>
      )}
    </Card>
  )
}
