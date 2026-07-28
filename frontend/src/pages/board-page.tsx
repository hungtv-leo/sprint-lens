import { Alert, Card, Col, Empty, Row, Spin, Statistic } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import { KanbanBoard } from '../components/kanban/kanban-board'
import { PageBody } from '../components/layout/page-body'
import { ProjectFilters } from '../components/layout/project-filters'
import { TopBar } from '../components/layout/top-bar'
import {
  useAppConfig,
  useIssues,
  useProjects,
  useSprints,
  useStatuses,
} from '../hooks/jira-hooks'
import { useLocalStorage } from '../hooks/use-local-storage'

export function BoardPage() {
  const [selectedProjects, setSelectedProjects] = useLocalStorage<string[]>(
    'sprint-lens.projects',
    [],
  )
  const [selectedSprint, setSelectedSprint] = useLocalStorage<string>('sprint-lens.sprint', '')
  const [assignee, setAssignee] = useLocalStorage<string>('sprint-lens.assignee', '')
  const [query, setQuery] = useState('')
  const [defaultsApplied, setDefaultsApplied] = useState(false)

  const projectsQuery = useProjects()
  const configQuery = useAppConfig()
  const sprintsQuery = useSprints(selectedProjects)
  const statusesQuery = useStatuses(selectedProjects)
  const issuesQuery = useIssues({
    projects: selectedProjects,
    sprint: selectedSprint,
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

  const issues = issuesQuery.data?.issues ?? []

  const fallbackStatuses = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; name: string; category_key: string; category_name: string }
    >()
    for (const issue of issues) {
      if (!seen.has(issue.status_id)) {
        seen.set(issue.status_id, {
          id: issue.status_id,
          name: issue.status_name,
          category_key: issue.status_category,
          category_name: issue.status_category,
        })
      }
    }
    return Array.from(seen.values())
  }, [issues])

  const statuses = statusesQuery.data?.length ? statusesQuery.data : fallbackStatuses
  const loading =
    selectedProjects.length > 0 &&
    (issuesQuery.isPending || statusesQuery.isPending || sprintsQuery.isPending)
  const truncated = Boolean(issuesQuery.data?.truncated)

  return (
    <div>
      <TopBar
        title="Bảng Kanban"
        description="Theo dõi task theo từng cột trạng thái thực tế của Jira với bố cục gọn, dễ lướt và dễ nhận biết điểm tắc nghẽn."
        onRefresh={async () => {
          await Promise.all([
            projectsQuery.refetch(),
            sprintsQuery.refetch(),
            statusesQuery.refetch(),
            issuesQuery.refetch(),
          ])
        }}
        refreshing={statusesQuery.isFetching || issuesQuery.isFetching}
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
          query={query}
          onQueryChange={setQuery}
        />

        {issuesQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Không thể tải issues hoặc trạng thái từ Jira."
          />
        ) : null}

        {truncated ? (
          <Alert
            type="warning"
            showIcon
            message={`Đang hiển thị ${issuesQuery.data?.returned}/${issuesQuery.data?.total} issues (giới hạn an toàn).`}
          />
        ) : null}

        {selectedProjects.length === 0 ? (
          <Card>
            <Empty description="Chọn ít nhất một project để hiển thị bảng." />
          </Card>
        ) : (
          <Spin spinning={loading}>
            <Row gutter={[12, 12]}>
              <Col xs={8} sm={8}>
                <Card size="small">
                  <Statistic title="Project" value={selectedProjects.length} />
                </Card>
              </Col>
              <Col xs={8} sm={8}>
                <Card size="small">
                  <Statistic title="Trạng thái" value={statuses.length} />
                </Card>
              </Col>
              <Col xs={8} sm={8}>
                <Card size="small">
                  <Statistic title="Task đang hiện" value={issues.length} />
                </Card>
              </Col>
            </Row>

            <div style={{ marginTop: 12 }}>
              <KanbanBoard statuses={statuses} issues={issues} />
            </div>
          </Spin>
        )}
      </PageBody>
    </div>
  )
}
