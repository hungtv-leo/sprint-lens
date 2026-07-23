import { Card, Empty, Grid, List, Tag, Typography } from 'antd'

import type { JiraIssue } from '../../lib/types'
import { formatDate } from '../../lib/utils'

const { useBreakpoint } = Grid

type IssueListCardProps = {
  title: string
  issues: JiraIssue[]
  emptyText: string
}

export function IssueListCard({ title, issues, emptyText }: IssueListCardProps) {
  const screens = useBreakpoint()
  const listHeight = !screens.md ? 280 : 360

  return (
    <Card
      size={!screens.md ? 'small' : 'default'}
      title={title}
      extra={<Typography.Text type="secondary">{issues.length} mục</Typography.Text>}
      style={{ height: '100%' }}
      styles={{
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
              extra={<Tag>{issue.status_name}</Tag>}
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
                  <a href={issue.url} target="_blank" rel="noreferrer">
                    {issue.key}
                  </a>
                }
                description={issue.summary}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
