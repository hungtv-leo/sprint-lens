import { FilterOutlined, RedoOutlined } from '@ant-design/icons'
import { Button, Card, Col, Grid, Input, Row, Select, Space, Typography } from 'antd'

import { useUsers } from '../../hooks/jira-hooks'
import { userFilterValue } from '../../lib/api'
import type { JiraProject, JiraSprint } from '../../lib/types'

const { useBreakpoint } = Grid

type FiltersProps = {
  projects: JiraProject[]
  selectedProjects: string[]
  sprint: string
  onProjectsChange: (projects: string[]) => void
  onSprintChange: (value: string) => void
  sprints?: JiraSprint[]
  assignee: string
  onAssigneeChange: (value: string) => void
  query?: string
  onQueryChange?: (value: string) => void
}

const sprintStateLabel: Record<string, string> = {
  active: 'đang chạy',
  closed: 'đã đóng',
  future: 'sắp tới',
}

export function ProjectFilters({
  projects,
  selectedProjects,
  onProjectsChange,
  sprint,
  onSprintChange,
  sprints = [],
  assignee,
  onAssigneeChange,
  query = '',
  onQueryChange,
}: FiltersProps) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const usersQuery = useUsers(selectedProjects)
  const hasFilters =
    selectedProjects.length > 0 ||
    Boolean(sprint) ||
    Boolean(assignee) ||
    Boolean(query.trim())

  return (
    <Card
      size={isMobile ? 'small' : 'default'}
      title={
        <Space>
          <FilterOutlined />
          <span>Bộ lọc sprint</span>
        </Space>
      }
      extra={
        <Space wrap size={[8, 8]} style={{ justifyContent: 'flex-end' }}>
          {!isMobile ? (
            <Typography.Text type="secondary">
              {selectedProjects.length} project đã chọn
            </Typography.Text>
          ) : null}
          {hasFilters ? (
            <Button
              icon={<RedoOutlined />}
              size="small"
              onClick={() => {
                onProjectsChange([])
                onSprintChange('')
                onAssigneeChange('')
                onQueryChange?.('')
              }}
            >
              {isMobile ? 'Xóa' : 'Xóa bộ lọc'}
            </Button>
          ) : null}
        </Space>
      }
    >
      {!isMobile ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Chọn project, sprint và điều kiện cần để tập trung vào phần quan trọng.
        </Typography.Paragraph>
      ) : null}

      <Row gutter={[12, 12]}>
        <Col xs={24} md={onQueryChange ? 8 : 10}>
          <Typography.Text type="secondary">Project</Typography.Text>
          <Select
            mode="multiple"
            allowClear
            maxTagCount={isMobile ? 1 : 'responsive'}
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Chọn project"
            value={selectedProjects}
            onChange={(projectsValue) => {
              onProjectsChange(projectsValue)
              onAssigneeChange('')
            }}
            options={projects.map((project) => ({
              value: project.key,
              label: `${project.key} - ${project.name}`,
            }))}
            optionFilterProp="label"
            getPopupContainer={(node) => node.parentElement ?? document.body}
          />
        </Col>

        <Col xs={24} sm={12} md={onQueryChange ? 5 : 7}>
          <Typography.Text type="secondary">Sprint</Typography.Text>
          <Select
            allowClear
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Tất cả sprint"
            value={sprint || undefined}
            onChange={(value) => onSprintChange(value ?? '')}
            options={[
              { value: '', label: 'Tất cả sprint' },
              { value: 'active', label: 'Sprint đang chạy' },
              ...sprints.map((item) => ({
                value: String(item.id),
                label: `${item.name} (${sprintStateLabel[item.state] ?? item.state})`,
              })),
            ]}
            getPopupContainer={(node) => node.parentElement ?? document.body}
          />
        </Col>

        <Col xs={24} sm={12} md={onQueryChange ? 5 : 7}>
          <Typography.Text type="secondary">Người được giao</Typography.Text>
          <Select
            showSearch
            allowClear
            style={{ width: '100%', marginTop: 8 }}
            placeholder={
              selectedProjects.length > 0 ? 'Chọn nhân viên' : 'Chọn project trước'
            }
            value={assignee || undefined}
            onChange={(value) => onAssigneeChange(value ?? '')}
            disabled={selectedProjects.length === 0}
            loading={usersQuery.isFetching}
            options={(usersQuery.data ?? [])
              .filter((user) => user.active !== false)
              .map((user) => ({
              value: userFilterValue(user),
              label: user.email
                ? `${user.display_name} (${user.email})`
                : user.display_name,
            }))}
            optionFilterProp="label"
            notFoundContent={
              usersQuery.isError
                ? 'Không tải được danh sách nhân viên'
                : 'Không có nhân viên'
            }
            getPopupContainer={(node) => node.parentElement ?? document.body}
          />
        </Col>

        {onQueryChange ? (
          <Col xs={24} md={6}>
            <Typography.Text type="secondary">Tìm kiếm</Typography.Text>
            <Input
              allowClear
              style={{ marginTop: 8 }}
              placeholder="Key hoặc summary"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </Col>
        ) : null}
      </Row>
    </Card>
  )
}
