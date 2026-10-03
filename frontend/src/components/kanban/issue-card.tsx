import { Card, Space, Tag, Typography, theme } from 'antd'

import type { JiraIssue } from '../../lib/types'
import { formatDate } from '../../lib/utils'
import { palette } from '../../theme/palette'
import { accentTagStyle } from '../../theme/tag-style'
import { useThemeMode } from '../../theme/theme-provider'

function priorityColor(priority: string | null | undefined) {
  const value = (priority ?? '').toLowerCase()
  if (value.includes('highest') || value.includes('critical') || value.includes('blocker')) {
    return palette.danger500
  }
  if (value.includes('high')) return palette.peach500
  if (value.includes('medium') || value.includes('normal')) return palette.gold500
  if (value.includes('low') || value.includes('lowest')) return palette.aqua500
  return palette.primary500
}

export function IssueCard({ issue }: { issue: JiraIssue }) {
  const { token } = theme.useToken()
  const { mode } = useThemeMode()
  const accent = priorityColor(issue.priority)
  const isDark = mode === 'dark'

  return (
    <Card
      size="small"
      hoverable
      styles={{
        body: {
          borderLeft: `3px solid ${accent}`,
          background: `linear-gradient(90deg, ${accent}14 0%, transparent 48%)`,
        },
      }}
      title={
        <a href={issue.url} target="_blank" rel="noreferrer" style={{ color: token.colorPrimary }}>
          {issue.key}
        </a>
      }
      extra={
        <Tag style={{ marginInlineEnd: 0, ...accentTagStyle(accent, isDark) }}>
          {issue.priority ?? 'Bình thường'}
        </Tag>
      }
    >
      <Typography.Paragraph style={{ marginBottom: 12, color: token.colorText }}>
        {issue.summary}
      </Typography.Paragraph>
      <Space wrap size="small">
        <Tag style={accentTagStyle(palette.aqua500, isDark)}>{issue.assignee.display_name}</Tag>
        <Tag style={accentTagStyle(palette.primary500, isDark)}>{issue.project_key}</Tag>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(issue.updated)}
        </Typography.Text>
      </Space>
    </Card>
  )
}
