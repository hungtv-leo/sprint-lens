import { Badge, Card, Col, Empty, Grid, Row, Typography } from 'antd'

import type { JiraIssue, JiraStatus } from '../../lib/types'
import { IssueCard } from './issue-card'

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
  return (
    <Card
      size="small"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        body: {
          height: bodyHeight,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      }}
      title={
        <div style={{ minWidth: 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {column.category_name}
          </Typography.Text>
          <div style={{ wordBreak: 'break-word' }}>{column.name}</div>
        </div>
      }
      extra={<Badge count={column.items.length} showZero color="blue" />}
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
