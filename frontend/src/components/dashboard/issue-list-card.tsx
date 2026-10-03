import { Card, Empty, Grid, List, Tag, Typography, theme } from 'antd'

import type { JiraIssue } from '../../lib/types'
import { formatDate } from '../../lib/utils'
import { palette } from '../../theme/palette'
import { accentTagStyle } from '../../theme/tag-style'
import { useThemeMode } from '../../theme/theme-provider'

const { useBreakpoint } = Grid

type IssueListCardProps = {
  title: string
  issues: JiraIssue[]
  emptyText: string
}

export function IssueListCard({ title, issues, emptyText }: IssueListCardProps) {
  const screens = useBreakpoint()
  const { token } = theme.useToken()
  const { mode } = useThemeMode()
  const listHeight = !screens.md ? 280 : 360
  const accent = title.toLowerCase().includes('testing') ? palette.aqua500 : palette.gold500
  const isDark = mode === 'dark'

  return (
    <Card
      size={!screens.md ? 'small' : 'default'}
      title={title}
      extra={<Typography.Text type="secondary">{issues.length} mục</Typography.Text>}
      style={{ height: '100%', borderTop: `3px solid ${accent}` }}
      styles={{
        header: {
          background: `linear-gradient(90deg, ${accent}16 0%, transparent 70%)`,
        },
        body: {
          height: listHeight,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      }}
    >
      {issues.length === 0 ? (
        <Empty
          description={emptyText}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 48 }}
        />
      ) : (
        <List
          itemLayout="vertical"
          dataSource={issues}
          renderItem={(issue) => (
            <List.Item
              key={issue.key}
              extra={
                <Tag style={accentTagStyle(accent, isDark)}>{issue.status_name}</Tag>
              }
              actions={[
                <Typography.Text type="secondary" key="assignee">
                  {issue.assignee.display_name}
                </Typography.Text>,
                <Typography.Text type="secondary" key="project">
                  {issue.project_key}
                </Typography.Text>,
                <Typography.Text type="secondary" key="updated">
                  {formatDate(issue.updated)}
                </Typography.Text>,
              ]}
            >
              <List.Item.Meta
                title={
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: token.colorPrimary }}
                  >
                    {issue.key}
                  </a>
                }
                description={
                  <Typography.Text style={{ color: token.colorTextSecondary }}>
                    {issue.summary}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
