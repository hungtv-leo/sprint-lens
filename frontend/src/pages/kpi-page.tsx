import {
  CalculatorOutlined,
  DownloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  List,
  Radio,
  Row,
  Select,
  Space,
  Typography,
  message,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'

import { PageBody } from '../components/layout/page-body'
import { TopBar } from '../components/layout/top-bar'
import { useProjects, useSprints, useUsers } from '../hooks/jira-hooks'
import { useLocalStorage } from '../hooks/use-local-storage'
import { calculateKpi, exportKpi } from '../lib/api'
import type { KpiCalculateResponse, KpiPeriodType, KpiRequest } from '../lib/types'

function formatRate(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export function KpiPage() {
  const [selectedProjects, setSelectedProjects] = useLocalStorage<string[]>(
    'sprint-lens.projects',
    [],
  )
  const [periodType, setPeriodType] = useState<KpiPeriodType>('sprint')
  const [sprint, setSprint] = useLocalStorage<string>('sprint-lens.sprint', '')
  const [month, setMonth] = useState<Dayjs>(dayjs())
  const [assignee, setAssignee] = useState('')
  const [calculating, setCalculating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<KpiCalculateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const projectsQuery = useProjects()
  const firstProject = selectedProjects[0]
  const sprintsQuery = useSprints(firstProject)
  const usersQuery = useUsers(selectedProjects)

  const canSubmit = selectedProjects.length > 0 && Boolean(assignee.trim())

  const requestBody: KpiRequest | null = useMemo(() => {
    if (!canSubmit) return null
    return {
      role: 'developer',
      assignee: assignee.trim(),
      projects: selectedProjects,
      period:
        periodType === 'sprint'
          ? { type: 'sprint', sprint: sprint || null }
          : { type: 'month', month: month.format('YYYY-MM') },
    }
  }, [assignee, canSubmit, month, periodType, selectedProjects, sprint])

  async function handleCalculate() {
    if (!requestBody) return
    setCalculating(true)
    setError(null)
    try {
      const data = await calculateKpi(requestBody)
      setResult(data)
      message.success('Đã tính toán KPI Developer')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Không tính được KPI'
      setError(text)
      message.error('Tính toán KPI thất bại')
    } finally {
      setCalculating(false)
    }
  }

  async function handleExport() {
    if (!requestBody) return
    setExporting(true)
    setError(null)
    try {
      const blob = await exportKpi(requestBody)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const stamp =
        requestBody.period.type === 'month'
          ? requestBody.period.month
          : requestBody.period.sprint ?? 'all-project'
      anchor.href = url
      anchor.download = `KPI_developer_${requestBody.assignee}_${stamp}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
      message.success('Đã xuất file KPI')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Không xuất được file KPI'
      setError(text)
      message.error('Xuất KPI thất bại')
    } finally {
      setExporting(false)
    }
  }

  const stats = result?.result.stats

  return (
    <div>
      <TopBar
        title="KPI"
        description="Tính toán và xuất KPI Developer theo sprint hoặc tháng. Agent đọc skill kpi-developer rồi điền vào file mẫu."
      />

      <PageBody>
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={10}>
            <Card title="Bộ lọc" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Typography.Text type="secondary">Role</Typography.Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    value="developer"
                    options={[{ value: 'developer', label: 'Developer' }]}
                    disabled
                  />
                </div>

                <div>
                  <Typography.Text type="secondary">Project</Typography.Text>
                  <Select
                    mode="multiple"
                    allowClear
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Chọn project"
                    value={selectedProjects}
                    onChange={(projects) => {
                      setSelectedProjects(projects)
                      setAssignee('')
                    }}
                    options={(projectsQuery.data ?? []).map((project) => ({
                      value: project.key,
                      label: `${project.key} - ${project.name}`,
                    }))}
                    optionFilterProp="label"
                  />
                </div>

                <div>
                  <Typography.Text type="secondary">Người được giao</Typography.Text>
                  <Select
                    showSearch
                    allowClear
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder={
                      selectedProjects.length
                        ? 'Chọn nhân viên'
                        : 'Chọn project trước'
                    }
                    value={assignee || undefined}
                    onChange={(value) => setAssignee(value ?? '')}
                    disabled={selectedProjects.length === 0}
                    loading={usersQuery.isFetching}
                    options={(usersQuery.data ?? []).map((user) => ({
                      value: user.display_name,
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
                  />
                </div>

                <div>
                  <Typography.Text type="secondary">Kỳ đánh giá</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Radio.Group
                      value={periodType}
                      onChange={(event) => setPeriodType(event.target.value)}
                      optionType="button"
                      buttonStyle="solid"
                      options={[
                        { value: 'sprint', label: 'Theo sprint' },
                        { value: 'month', label: 'Theo tháng' },
                      ]}
                    />
                  </div>
                </div>

                {periodType === 'sprint' ? (
                  <div>
                    <Typography.Text type="secondary">Sprint</Typography.Text>
                    <Select
                      allowClear
                      style={{ width: '100%', marginTop: 8 }}
                      placeholder="Tất cả sprint"
                      value={sprint || undefined}
                      onChange={(value) => setSprint(value ?? '')}
                      options={[
                        { value: '', label: 'Tất cả sprint' },
                        { value: 'active', label: 'Sprint đang chạy' },
                        ...(sprintsQuery.data ?? []).map((item) => ({
                          value: String(item.id),
                          label: `${item.name} (${item.state})`,
                        })),
                      ]}
                    />
                  </div>
                ) : (
                  <div>
                    <Typography.Text type="secondary">Tháng</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <DatePicker
                        picker="month"
                        style={{ width: '100%' }}
                        value={month}
                        onChange={(value) => value && setMonth(value)}
                        allowClear={false}
                      />
                    </div>
                  </div>
                )}

                <Space wrap>
                  <Button
                    type="primary"
                    icon={<CalculatorOutlined />}
                    loading={calculating}
                    disabled={!canSubmit}
                    onClick={handleCalculate}
                  >
                    Tính toán
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    loading={exporting}
                    disabled={!canSubmit}
                    onClick={handleExport}
                  >
                    Xuất file KPI
                  </Button>
                </Space>
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={14}>
            <Card
              title={
                <Space>
                  <FileExcelOutlined />
                  <span>Kết quả tính toán</span>
                </Space>
              }
              size="small"
              extra={
                result ? (
                  <Typography.Text type="secondary">Agent: {result.agent}</Typography.Text>
                ) : null
              }
            >
              {error ? (
                <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
              ) : null}

              {!result && !error ? (
                <Typography.Text type="secondary">
                  Chọn bộ lọc rồi nhấn Tính toán để Agent đọc skill và thống kê task hoàn thành /
                  chưa hoàn thành.
                </Typography.Text>
              ) : null}

              {stats ? (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Row gutter={[12, 12]}>
                    <Col xs={12} sm={8}>
                      <Card size="small">
                        <Typography.Text type="secondary">Tổng (committed)</Typography.Text>
                        <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
                          {stats.committed}
                        </Typography.Title>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Card size="small">
                        <Typography.Text type="secondary">Hoàn thành</Typography.Text>
                        <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
                          {stats.completed}
                        </Typography.Title>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Card size="small">
                        <Typography.Text type="secondary">Chưa hoàn thành</Typography.Text>
                        <Typography.Title level={3} style={{ margin: '4px 0 0' }}>
                          {stats.incomplete}
                        </Typography.Title>
                      </Card>
                    </Col>
                  </Row>

                  <Descriptions size="small" bordered column={1}>
                    <Descriptions.Item label="Commitment (J5)">
                      {formatRate(stats.commitment_rate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Schedule (J6)">
                      {formatRate(stats.schedule_rate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Throughput (J7)">
                      {formatRate(stats.throughput_rate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Issues đã lấy">
                      {result?.issue_count ?? 0}
                    </Descriptions.Item>
                  </Descriptions>

                  {result?.result.notes?.length ? (
                    <Alert
                      type="info"
                      showIcon
                      message="Ghi chú từ Agent"
                      description={
                        <List
                          size="small"
                          dataSource={result.result.notes}
                          renderItem={(item) => <List.Item>{item}</List.Item>}
                        />
                      }
                    />
                  ) : null}

                  {result?.result.evidence?.length ? (
                    <Card size="small" title="Evidence (rút gọn)">
                      <List
                        size="small"
                        dataSource={result.result.evidence.slice(0, 20)}
                        renderItem={(item) => (
                          <List.Item style={{ paddingInline: 0 }}>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr',
                                alignItems: 'center',
                                width: '100%',
                              }}
                            >
                              <Typography.Text code style={{ justifySelf: 'start' }}>
                                {item.key}
                              </Typography.Text>
                              <Typography.Text
                                type="secondary"
                                style={{ justifySelf: 'center', whiteSpace: 'nowrap' }}
                              >
                                {item.bucket}
                              </Typography.Text>
                              <Typography.Text
                                type="secondary"
                                style={{ justifySelf: 'end', textAlign: 'right' }}
                              >
                                {item.note || '—'}
                              </Typography.Text>
                            </div>
                          </List.Item>
                        )}
                      />
                    </Card>
                  ) : null}
                </Space>
              ) : null}
            </Card>
          </Col>
        </Row>
      </PageBody>
    </div>
  )
}
