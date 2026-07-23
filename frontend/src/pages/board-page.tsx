import { Card, Col, Empty, Row, Statistic } from 'antd'
import { useMemo, useState } from 'react'

import { KanbanBoard } from '../components/kanban/kanban-board'
import { PageBody } from '../components/layout/page-body'
import { ProjectFilters } from '../components/layout/project-filters'
import { TopBar } from '../components/layout/top-bar'
import { useIssues, useProjects, useSprints, useStatuses } from '../hooks/jira-hooks'
import { useLocalStorage } from '../hooks/use-local-storage'

export function BoardPage() {
  const [selectedProjects, setSelectedProjects] = useLocalStorage<string[]>(
    'sprint-lens.projects',
    [],
  )
  const [selectedSprint, setSelectedSprint] = useLocalStorage<string>('sprint-lens.sprint', '')
  const [assignee, setAssignee] = useState('')

  const projectsQuery = useProjects()
  const primaryProject = selectedProjects[0]
  const sprintsQuery = useSprints(primaryProject)
  const statusesQuery = useStatuses(primaryProject)
  const issuesQuery = useIssues({
    projects: selectedProjects,
    sprint: selectedSprint,
    assignee,
  })

  const fallbackStatuses = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; name: string; category_key: string; category_name: string }
    >()
    for (const issue of issuesQuery.data ?? []) {
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
  }, [issuesQuery.data])

  const statuses = statusesQuery.data?.length ? statusesQuery.data : fallbackStatuses

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
        />

        {selectedProjects.length === 0 ? (
          <Card>
            <Empty description="Chọn ít nhất một project để hiển thị bảng." />
          </Card>
        ) : (
          <>
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
                  <Statistic title="Task đang hiện" value={(issuesQuery.data ?? []).length} />
                </Card>
              </Col>
            </Row>

            <KanbanBoard statuses={statuses} issues={issuesQuery.data ?? []} />
          </>
        )}
      </PageBody>
    </div>
  )
}
