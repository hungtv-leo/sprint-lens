import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import { Alert, Card, Col, Row, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'

import { AssigneeChart } from '../components/dashboard/assignee-chart'
import { IssueListCard } from '../components/dashboard/issue-list-card'
import { StatCard } from '../components/dashboard/stat-card'
import { StatusChart } from '../components/dashboard/status-chart'
import { ProjectFilters } from '../components/layout/project-filters'
import { PageBody } from '../components/layout/page-body'
import { TopBar } from '../components/layout/top-bar'
import { useIssues, useProjects, useSprints, useSummary } from '../hooks/jira-hooks'
import { useLocalStorage } from '../hooks/use-local-storage'

export function DashboardPage() {
  const [selectedProjects, setSelectedProjects] = useLocalStorage<string[]>(
    'sprint-lens.projects',
    [],
  )
  const [selectedSprint, setSelectedSprint] = useLocalStorage<string>('sprint-lens.sprint', '')
  const [assignee, setAssignee] = useState('')

  const projectsQuery = useProjects()
  const firstProject = selectedProjects[0]
  const sprintsQuery = useSprints(firstProject)

  const summaryQuery = useSummary({
    projects: selectedProjects,
    sprint: selectedSprint,
    assignee,
  })
  const issuesQuery = useIssues({
    projects: selectedProjects,
    sprint: selectedSprint,
    assignee,
  })

  const summary = summaryQuery.data

  const stats = useMemo(() => {
    const issues = issuesQuery.data ?? []
    const unstarted = issues.filter((issue) => issue.status_category === 'new').length
    const testing = issues.filter((issue) =>
      ['test', 'testing', 'qa', 'uat'].some((keyword) =>
        issue.status_name.toLowerCase().includes(keyword),
      ),
    ).length
    const done = issues.filter((issue) => issue.status_category === 'done').length

    return { unstarted, testing, done }
  }, [issuesQuery.data])

  return (
    <div>
      <TopBar
        title="Tổng quan"
        description="Tổng quan sprint theo project với KPI rõ ràng, biểu đồ dễ đọc và danh sách task cần can thiệp ngay."
        onRefresh={async () => {
          await Promise.all([
            projectsQuery.refetch(),
            sprintsQuery.refetch(),
            summaryQuery.refetch(),
            issuesQuery.refetch(),
          ])
        }}
        refreshing={summaryQuery.isFetching || issuesQuery.isFetching}
      />

      <PageBody>
        <ProjectFilters
          projects={projectsQuery.data ?? []}
          selectedProjects={selectedProjects}
          onProjectsChange={setSelectedProjects}
          sprint={selectedSprint}
          onSprintChange={setSelectedSprint}
          sprints={sprintsQuery.data}
          assignee={assignee}
          onAssigneeChange={setAssignee}
        />

        {summaryQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Không thể tải dữ liệu Jira. Hãy kiểm tra token, project key và quyền API."
          />
        ) : null}

        <Row gutter={[12, 12]}>
          <Col xs={12} sm={12} xl={6}>
            <StatCard
              label="Tổng task"
              value={summary?.total ?? 0}
              hint="Tổng số issue trong bộ lọc hiện tại"
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <StatCard
              label="Chưa bắt đầu"
              value={stats.unstarted}
              hint="Cần ưu tiên mở task hoặc giao việc"
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <StatCard
              label="Đang testing"
              value={stats.testing}
              hint="Cần theo dõi sát để không trễ sprint"
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <StatCard label="Đã xong" value={stats.done} hint="Số task đã vào nhóm hoàn thành" />
          </Col>
        </Row>

        <Row gutter={[12, 12]} align="stretch">
          <Col xs={24} lg={14} style={{ display: 'flex' }}>
            <div style={{ width: '100%', minWidth: 0 }}>
              <StatusChart data={summary?.statuses ?? []} />
            </div>
          </Col>
          <Col xs={24} lg={10} style={{ display: 'flex' }}>
            <div style={{ width: '100%', minWidth: 0 }}>
              <AssigneeChart data={summary?.assignees ?? []} />
            </div>
          </Col>
        </Row>

        <Row gutter={[12, 12]} align="stretch">
          <Col xs={24} xl={12}>
            <IssueListCard
              title="Task chưa bắt đầu"
              issues={summary?.unstarted ?? []}
              emptyText="Không có task đang ở trạng thái chưa bắt đầu."
            />
          </Col>
          <Col xs={24} xl={12}>
            <IssueListCard
              title="Task đang testing"
              issues={summary?.testing ?? []}
              emptyText="Không có task nào đang trong vòng testing."
            />
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          {[
            {
              icon: <MinusCircleOutlined />,
              title: 'Chưa bắt đầu',
              value: `${stats.unstarted} task`,
            },
            {
              icon: <ClockCircleOutlined />,
              title: 'Đang xử lý',
              value: `${Math.max((summary?.total ?? 0) - stats.unstarted - stats.done, 0)} task`,
            },
            {
              icon: <AlertOutlined />,
              title: 'Cần review',
              value: `${stats.testing} task`,
            },
            {
              icon: <CheckCircleOutlined />,
              title: 'Hoàn thành',
              value: `${stats.done} task`,
            },
          ].map((item) => (
            <Col key={item.title} xs={12} sm={12} xl={6}>
              <Card size="small">
                <Space direction="vertical" size={4}>
                  {item.icon}
                  <Typography.Text type="secondary">{item.title}</Typography.Text>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {item.value}
                  </Typography.Title>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </PageBody>
    </div>
  )
}
