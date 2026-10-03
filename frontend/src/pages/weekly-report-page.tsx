import { Alert, Card, Col, DatePicker, Row, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect, useMemo, useState } from 'react'

import { PageBody } from '../components/layout/page-body'
import { TopBar } from '../components/layout/top-bar'
import { useAppConfig, useProjects, useUsers } from '../hooks/jira-hooks'
import { useLocalStorage } from '../hooks/use-local-storage'
import { useWeeklyReport } from '../hooks/weekly-report-hooks'
import { userFilterValue } from '../lib/api'
import type { WeeklyReportIssue, WeeklyReportTreeIssue } from '../lib/types'
import { formatDate } from '../lib/utils'

const DEFAULT_NAME_HINTS = ['hưng', 'hương', 'đạt']

const SOURCE_LABEL: Record<string, string> = {
  sprint: 'Sprint',
  adhoc: 'Ad-hoc',
  both: 'Sprint + Ad-hoc',
  parent: 'Parent',
}

const BUCKET_COLOR: Record<string, string> = {
  in_progress: 'processing',
  ready_for_test: 'gold',
  testing: 'blue',
  done: 'success',
  cancelled: 'default',
  other: 'purple',
}

function buildIssueTree(issues: WeeklyReportIssue[]): WeeklyReportTreeIssue[] {
  const nodes = new Map<string, WeeklyReportTreeIssue>()
  for (const issue of issues) {
    nodes.set(issue.key, { ...issue })
  }

  const roots: WeeklyReportTreeIssue[] = []
  for (const node of nodes.values()) {
    const parentKey = node.parent_key
    if (parentKey && nodes.has(parentKey)) {
      const parent = nodes.get(parentKey)!
      if (!parent.children) parent.children = []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (items: WeeklyReportTreeIssue[]) => {
    items.sort((a, b) => {
      const aTime = a.updated || ''
      const bTime = b.updated || ''
      if (aTime !== bTime) return bTime.localeCompare(aTime)
      return a.key.localeCompare(b.key)
    })
    for (const item of items) {
      if (item.children?.length) sortNodes(item.children)
      else delete item.children
    }
  }
  sortNodes(roots)
  return roots
}

export function WeeklyReportPage() {
  const [selectedProjects, setSelectedProjects] = useLocalStorage<string[]>(
    'sprint-lens.projects',
    [],
  )
  const [selectedAssignees, setSelectedAssignees] = useLocalStorage<string[]>(
    'sprint-lens.weekly-assignees',
    [],
  )
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(6, 'day'),
    dayjs(),
  ])
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [assigneesSeeded, setAssigneesSeeded] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const projectsQuery = useProjects()
  const configQuery = useAppConfig()
  const usersQuery = useUsers(selectedProjects)

  useEffect(() => {
    if (defaultsApplied || selectedProjects.length > 0) return
    const defaults = configQuery.data?.default_projects ?? []
    if (defaults.length === 0) return
    setSelectedProjects(defaults)
    setDefaultsApplied(true)
  }, [configQuery.data, defaultsApplied, selectedProjects.length, setSelectedProjects])

  useEffect(() => {
    if (assigneesSeeded || selectedAssignees.length > 0) return
    const users = usersQuery.data ?? []
    if (users.length === 0) return
    const matched = users
      .filter((user) => {
        const name = user.display_name.toLowerCase()
        return DEFAULT_NAME_HINTS.some((hint) => name.includes(hint))
      })
      .map((user) => userFilterValue(user))
      .filter(Boolean)
    if (matched.length > 0) {
      setSelectedAssignees(matched)
    }
    setAssigneesSeeded(true)
  }, [assigneesSeeded, selectedAssignees.length, setSelectedAssignees, usersQuery.data])

  const dateFrom = range[0].format('YYYY-MM-DD')
  const dateTo = range[1].format('YYYY-MM-DD')

  const reportQuery = useWeeklyReport({
    projects: selectedProjects,
    assignees: selectedAssignees,
    date_from: dateFrom,
    date_to: dateTo,
  })

  const report = reportQuery.data
  const issues = report?.issues ?? []
  const treeIssues = useMemo(() => buildIssueTree(issues), [issues])

  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, selectedProjects, selectedAssignees])

  const columns: ColumnsType<WeeklyReportTreeIssue> = useMemo(
    () => [
      {
        title: 'Key',
        dataIndex: 'key',
        width: 140,
        render: (_value, row) => (
          <Space size={6}>
            <a href={row.url} target="_blank" rel="noreferrer">
              {row.key}
            </a>
            {row.is_subtask ? <Tag>Sub-task</Tag> : null}
            {row.matched === false ? <Tag color="default">Parent</Tag> : null}
          </Space>
        ),
      },
      {
        title: 'Công việc',
        dataIndex: 'summary',
        ellipsis: true,
      },
      {
        title: 'Người',
        dataIndex: 'assignee_display_name',
        width: 160,
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status_name',
        width: 140,
        render: (value: string, row) => (
          <Tag color={BUCKET_COLOR[row.bucket] ?? 'default'}>{value}</Tag>
        ),
      },
      {
        title: 'Nhóm',
        dataIndex: 'bucket_label',
        width: 120,
      },
      {
        title: 'Nguồn',
        dataIndex: 'source',
        width: 130,
        render: (value: string) => SOURCE_LABEL[value] ?? value,
      },
      {
        title: 'Updated',
        dataIndex: 'updated',
        width: 120,
        render: (value?: string | null) => formatDate(value),
      },
    ],
    [],
  )

  return (
    <div>
      <TopBar
        title="Báo cáo tuần"
        description="Task có cập nhật trong tuần từ sprint đang chạy và board Ad-hoc, nhóm theo trạng thái cho từng người."
        onRefresh={async () => {
          await Promise.all([
            projectsQuery.refetch(),
            usersQuery.refetch(),
            reportQuery.refetch(),
          ])
        }}
        refreshing={reportQuery.isFetching}
      />

      <PageBody>
        <Card size="small" style={{ marginBottom: 12 }}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">Project</Typography.Text>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Chọn project"
                value={selectedProjects}
                onChange={setSelectedProjects}
                options={(projectsQuery.data ?? []).map((project) => ({
                  value: project.key,
                  label: `${project.key} - ${project.name}`,
                }))}
                optionFilterProp="label"
              />
            </Col>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">Người (Hưng, Hương, Đạt…)</Typography.Text>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%', marginTop: 8 }}
                placeholder={
                  selectedProjects.length > 0 ? 'Chọn nhân viên' : 'Chọn project trước'
                }
                value={selectedAssignees}
                onChange={setSelectedAssignees}
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
              />
            </Col>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">Khoảng thời gian</Typography.Text>
              <DatePicker.RangePicker
                style={{ width: '100%', marginTop: 8 }}
                value={range}
                onChange={(value) => {
                  if (!value?.[0] || !value[1]) return
                  setRange([value[0], value[1]])
                }}
                format="DD/MM/YYYY"
                allowClear={false}
              />
            </Col>
          </Row>
        </Card>

        {reportQuery.isError ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="Không tải được báo cáo tuần từ Jira."
          />
        ) : null}

        {(report?.notes ?? []).map((note) => (
          <Alert
            key={note}
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={note}
          />
        ))}

        {report?.truncated ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="Dữ liệu bị cắt do giới hạn an toàn của API."
          />
        ) : null}

        {selectedProjects.length === 0 || selectedAssignees.length === 0 ? (
          <Card>
            <Typography.Text type="secondary">
              Chọn project và ít nhất một người để xem báo cáo tuần.
            </Typography.Text>
          </Card>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Row gutter={[12, 12]}>
              <Col xs={12} md={4}>
                <Card size="small">
                  <Typography.Text type="secondary">Tổng task</Typography.Text>
                  <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
                    {report?.total ?? 0}
                  </Typography.Title>
                </Card>
              </Col>
              {(report?.by_bucket ?? []).map((item) => (
                <Col xs={12} md={4} key={item.bucket}>
                  <Card size="small">
                    <Typography.Text type="secondary">{item.label}</Typography.Text>
                    <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
                      {item.total}
                    </Typography.Title>
                  </Card>
                </Col>
              ))}
            </Row>

            {(report?.by_assignee ?? []).length > 0 ? (
              <Card size="small" title="Theo người">
                <Row gutter={[12, 12]}>
                  {report?.by_assignee.map((person) => (
                    <Col xs={24} md={8} key={person.assignee}>
                      <Card size="small" type="inner" title={person.assignee_display_name}>
                        <Typography.Text type="secondary">
                          Tổng {person.total} task
                        </Typography.Text>
                        <div style={{ marginTop: 8 }}>
                          {Object.entries(person.by_bucket).map(([bucket, total]) => (
                            <Tag
                              key={bucket}
                              color={BUCKET_COLOR[bucket] ?? 'default'}
                              style={{ marginBottom: 6 }}
                            >
                              {(report?.by_bucket.find((item) => item.bucket === bucket)
                                ?.label ?? bucket)}
                              : {total}
                            </Tag>
                          ))}
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
                {report?.adhoc_board_name ? (
                  <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                    Đang gộp sprint active + board {report.adhoc_board_name} (
                    {dateFrom} → {dateTo})
                  </Typography.Paragraph>
                ) : null}
              </Card>
            ) : null}

            <Card size="small" title="Chi tiết task (parent → sub-task)">
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <Table
                  rowKey="key"
                  size="small"
                  loading={reportQuery.isPending || reportQuery.isFetching}
                  columns={columns}
                  dataSource={treeIssues}
                  expandable={{
                    defaultExpandAllRows: false,
                    indentSize: 20,
                  }}
                  pagination={{
                    current: page,
                    pageSize,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    onChange: (nextPage, nextPageSize) => {
                      setPage(nextPage)
                      setPageSize(nextPageSize)
                    },
                  }}
                  style={{ minWidth: 960 }}
                />
              </div>
            </Card>
          </Space>
        )}
      </PageBody>
    </div>
  )
}
