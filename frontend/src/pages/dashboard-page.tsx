import { Alert, Card, Col, Empty, Row, Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import { AssigneeChart } from '../components/dashboard/assignee-chart'
import { IssueListCard } from '../components/dashboard/issue-list-card'
import { StatCard } from '../components/dashboard/stat-card'
import { StatusChart } from '../components/dashboard/status-chart'
import { PageBody } from '../components/layout/page-body'
import { ProjectFilters } from '../components/layout/project-filters'
import { TopBar } from '../components/layout/top-bar'
import {
  useAppConfig,
  useBoards,
  useIssues,
  useProjects,
  useSprints,
  useSummary,
} from '../hooks/jira-hooks'
import { useLocalStorage } from '../hooks/use-local-storage'
import { statAccents } from '../theme/palette'

export function DashboardPage() {
  const [selectedProjects, setSelectedProjects] = useLocalStorage<string[]>(
    'sprint-lens.projects',
    [],
  )
  const [selectedSprint, setSelectedSprint] = useLocalStorage<string>('sprint-lens.sprint', '')
  const [selectedBoard, setSelectedBoard] = useLocalStorage<string>('sprint-lens.board', '')
  const [assignee, setAssignee] = useLocalStorage<string>('sprint-lens.assignee', '')
  const [query, setQuery] = useState('')
  const [defaultsApplied, setDefaultsApplied] = useState(false)

  const projectsQuery = useProjects()
  const configQuery = useAppConfig()
  const sprintsQuery = useSprints(selectedProjects)
  const boardsQuery = useBoards(selectedProjects)

  const summaryQuery = useSummary({
    projects: selectedProjects,
    sprint: selectedBoard ? undefined : selectedSprint,
    board: selectedBoard || undefined,
    assignee,
    q: query.trim() || undefined,
  })
  const issuesQuery = useIssues({
    projects: selectedProjects,
    sprint: selectedBoard ? undefined : selectedSprint,
    board: selectedBoard || undefined,
    assignee,
    q: query.trim() || undefined,
  })

  useEffect(() => {
    if (defaultsApplied || selectedProjects.length > 0) return
    const defaults = configQuery.data?.default_projects ?? []
    if (defaults.length === 0) return
    setSelectedProjects(defaults)
    setDefaultsApplied(true)
  }, [configQuery.data, defaultsApplied, selectedProjects.length, setSelectedProjects])

  const summary = summaryQuery.data
  const issues = issuesQuery.data?.issues ?? []
  const truncated = Boolean(summaryQuery.data?.truncated || issuesQuery.data?.truncated)
  const shown = issuesQuery.data?.returned ?? issues.length
  const total = issuesQuery.data?.total ?? summary?.total ?? 0

  const stats = useMemo(() => {
    const unstarted = issues.filter((issue) => issue.status_category === 'new').length
    const testing = issues.filter((issue) =>
      ['test', 'testing', 'qa', 'uat'].some((keyword) =>
        issue.status_name.toLowerCase().includes(keyword),
      ),
    ).length
    const done = issues.filter((issue) => issue.status_category === 'done').length

    return { unstarted, testing, done }
  }, [issues])

  const loading =
    selectedProjects.length > 0 &&
    (summaryQuery.isPending ||
      issuesQuery.isPending ||
      sprintsQuery.isPending ||
      boardsQuery.isPending)

  return (
    <div>
      <TopBar
        title="Tổng quan"
        description="Tổng quan sprint theo project với biểu đồ dễ đọc và danh sách task cần can thiệp ngay."
        onRefresh={async () => {
          await Promise.all([
            projectsQuery.refetch(),
            sprintsQuery.refetch(),
            boardsQuery.refetch(),
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
          board={selectedBoard}
          onBoardChange={setSelectedBoard}
          boards={boardsQuery.data}
          assignee={assignee}
          onAssigneeChange={setAssignee}
          query={query}
          onQueryChange={setQuery}
        />

        {summaryQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Không thể tải dữ liệu Jira. Hãy kiểm tra token, project key và quyền API."
          />
        ) : null}

        {truncated ? (
          <Alert
            type="warning"
            showIcon
            message={`Đang hiển thị ${shown}/${total} issues (giới hạn an toàn).`}
          />
        ) : null}

        {selectedProjects.length === 0 ? (
          <Card>
            <Empty description="Chọn ít nhất một project để xem tổng quan." />
          </Card>
        ) : (
          <Spin spinning={loading}>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={12} xl={6}>
                <StatCard
                  label="Tổng task"
                  value={summary?.total ?? 0}
                  hint="Tổng số issue trong bộ lọc hiện tại"
                  accent={statAccents.total}
                />
              </Col>
              <Col xs={12} sm={12} xl={6}>
                <StatCard
                  label="Chưa bắt đầu"
                  value={stats.unstarted}
                  hint="Cần ưu tiên mở task hoặc giao việc"
                  accent={statAccents.unstarted}
                />
              </Col>
              <Col xs={12} sm={12} xl={6}>
                <StatCard
                  label="Đang testing"
                  value={stats.testing}
                  hint="Cần theo dõi sát để không trễ sprint"
                  accent={statAccents.testing}
                />
              </Col>
              <Col xs={12} sm={12} xl={6}>
                <StatCard
                  label="Đã xong"
                  value={stats.done}
                  hint="Số task đã vào nhóm hoàn thành"
                  accent={statAccents.done}
                />
              </Col>
            </Row>

            <Row gutter={[12, 12]} align="stretch" style={{ marginTop: 12 }}>
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

            <Row gutter={[12, 12]} align="stretch" style={{ marginTop: 12 }}>
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
          </Spin>
        )}
      </PageBody>
    </div>
  )
}
