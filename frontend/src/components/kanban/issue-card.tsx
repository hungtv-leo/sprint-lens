import { Card, Space, Tag, Typography } from 'antd'

import type { JiraIssue } from '../../lib/types'
import { formatDate } from '../../lib/utils'

export function IssueCard({ issue }: { issue: JiraIssue }) {
  return (
    <Card
      size="small"
      hoverable
      title={
        <a href={issue.url} target="_blank" rel="noreferrer">
          {issue.key}
        </a>
      }
      extra={<Tag>{issue.priority ?? 'Bình thường'}</Tag>}
    >
      <Typography.Paragraph style={{ marginBottom: 12 }}>{issue.summary}</Typography.Paragraph>
      <Space wrap size="small">
        <Tag>{issue.assignee.display_name}</Tag>
        <Tag>{issue.project_key}</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(issue.updated)}
        </Typography.Text>
      </Space>
    </Card>
  )
}
