import {
  CalculatorOutlined,
  CloseOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  UploadOutlined,
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
  Upload,
  message,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import type { UploadFile } from 'antd/es/upload/interface'

import { PageBody } from '../components/layout/page-body'
import { TopBar } from '../components/layout/top-bar'
import { useProjects, useSprints, useUsers } from '../hooks/jira-hooks'
import { useLocalStorage } from '../hooks/use-local-storage'
import { calculateKpiWithWorkbook, downloadKpiTemplate, exportKpi, userFilterValue } from '../lib/api'
import type {
  KpiCalculateResponse,
  KpiPeriodType,
  KpiPlanValidationIssue,
  KpiRequest,
} from '../lib/types'

function formatRate(value: number | null | undefined) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

const EVIDENCE_BUCKET_LABELS: Record<string, string> = {
  completed: 'Hoàn thành',
  incomplete: 'Chưa hoàn thành',
  excluded: 'Loại trừ',
  missing_jira: 'Thiếu trên Jira',
  on_time: 'Đúng hạn',
  late: 'Trễ hạn',
}

function formatEvidenceBucket(bucket: string) {
  return EVIDENCE_BUCKET_LABELS[bucket] ?? bucket
}

function formatEvidenceNote(note: string) {
  if (!note) return '—'
  const trimmed = note.trim()
  const statusLabels: Record<string, string> = {
    Done: 'Hoàn thành',
    'To Do': 'Chưa làm',
    'In Progress': 'Đang làm',
  }
  if (statusLabels[trimmed]) return statusLabels[trimmed]

  return trimmed
    .replace(/\bdue\b/gi, 'hạn')
    .replace(/\bdone\b/gi, 'hoàn thành')
    .replace(/Cancelled\s*\/\s*withdrawn/gi, 'Đã hủy / rút lại')
    .replace(/plan_type=committed/gi, 'loại kế hoạch=Cam kết')
    .replace(/plan_type=stretch/gi, 'loại kế hoạch=Phát sinh')
    .replace(/plan_type=out_of_scope/gi, 'loại kế hoạch=Ngoài phạm vi')
    .replace(/Bỏ qua plan_type=/gi, 'Bỏ qua loại kế hoạch=')
}

const WARNING_LABELS: Record<string, string> = {
  missing_in_jira: 'Thiếu trên Jira',
  assignee_mismatch: 'Không khớp người được giao',
  assignee_mismatch_summary: 'Tóm tắt người được giao',
  unplanned_issue: 'Ngoài kế hoạch',
  jira_truncated: 'Dữ liệu Jira bị cắt ngưỡng',
  outside_requested_month: 'Ngoài tháng đang tính',
  expected_due_date_out_of_month: 'Hạn dự kiến lệch tháng',
  missing_task_title: 'Thiếu tên công việc',
  scope_score_too_large: 'Điểm khối lượng bất thường',
}

function formatWarningGroup(code: string) {
  return WARNING_LABELS[code] ?? code
}

function groupValidationIssues(items: KpiPlanValidationIssue[]) {
  const grouped = new Map<string, KpiPlanValidationIssue[]>()
  for (const item of items) {
    const list = grouped.get(item.code) ?? []
    list.push(item)
    grouped.set(item.code, list)
  }
  return Array.from(grouped.entries())
}

export function KpiPage() {
  const [selectedProjects, setSelectedProjects] = useLocalStorage<string[]>(
    'sprint-lens.projects',
    [],
  )
  const [periodType, setPeriodType] = useState<KpiPeriodType>('sprint')
  const [sprint, setSprint] = useLocalStorage<string>('sprint-lens.sprint', '')
  const [month, setMonth] = useState<Dayjs>(dayjs())
  const [assignee, setAssignee] = useLocalStorage<string>('sprint-lens.assignee', '')
  const [calculating, setCalculating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<KpiCalculateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [planFile, setPlanFile] = useState<File | null>(null)

  const projectsQuery = useProjects()
  const sprintsQuery = useSprints(selectedProjects)
  const usersQuery = useUsers(selectedProjects)

  const requiresWorkbook = periodType === 'month'
  const requiresSprint = periodType === 'sprint'
  const canSubmit =
    selectedProjects.length > 0 &&
    Boolean(assignee.trim()) &&
    (!requiresWorkbook || Boolean(planFile)) &&
    (!requiresSprint || Boolean(sprint))

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
      const data = await calculateKpiWithWorkbook(requestBody, planFile ?? undefined)
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
      const blob = await exportKpi(requestBody, planFile ?? undefined)
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

  async function handleDownloadTemplate() {
    try {
      const blob = await downloadKpiTemplate()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'kpi-plan-developer.xlsx'
      anchor.click()
      URL.revokeObjectURL(url)
      message.success('Đã tải file kế hoạch mẫu')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Không tải được file kế hoạch mẫu'
      setError(text)
      message.error('Tải file mẫu thất bại')
    }
  }

  const stats = result?.result.stats
  const warnings = result?.validation_issues ?? []
  const warningGroups = groupValidationIssues(warnings)
  const blockingWarnings = warnings.filter((item) => item.blocking)
  const canExport = Boolean(requestBody) && Boolean(result) && blockingWarnings.length === 0
  const checklist = [
    {
      done: selectedProjects.length > 0,
      label: 'Chọn ít nhất 1 dự án',
    },
    {
      done: Boolean(assignee.trim()),
      label: 'Chọn nhân viên',
    },
    {
      done: !requiresSprint || Boolean(sprint),
      label: 'Chọn sprint cụ thể khi tính theo sprint',
    },
    {
      done: !requiresWorkbook || Boolean(planFile),
      label: 'Tải lên file kế hoạch khi tính theo tháng',
    },
  ]

  return (
    <div>
      <TopBar
        title="KPI"
        description="Tính toán và xuất KPI cho lập trình viên theo sprint hoặc theo tháng, rồi điền kết quả vào file mẫu."
      />

      <PageBody>
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={10}>
            <Card title="Bộ lọc" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Typography.Text type="secondary">Vai trò</Typography.Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    value="developer"
                    options={[{ value: 'developer', label: 'Lập trình viên' }]}
                    disabled
                  />
                </div>

                <div>
                  <Typography.Text type="secondary">Dự án</Typography.Text>
                  <Select
                    mode="multiple"
                    allowClear
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="Chọn dự án"
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
                        : 'Chọn dự án trước'
                    }
                    value={assignee || undefined}
                    onChange={(value) => setAssignee(value ?? '')}
                    disabled={selectedProjects.length === 0}
                    loading={usersQuery.isFetching}
                    options={(usersQuery.data ?? []).map((user) => ({
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
                    <Typography.Text type="secondary">Sprint áp dụng</Typography.Text>
                    <Select
                      allowClear
                      style={{ width: '100%', marginTop: 8 }}
                      placeholder="Chọn sprint"
                      value={sprint || undefined}
                      onChange={(value) => setSprint(value ?? '')}
                      options={[
                        { value: 'active', label: 'Sprint đang chạy' },
                        ...(sprintsQuery.data ?? []).map((item) => ({
                          value: String(item.id),
                          label: `${item.name} (${item.state})`,
                        })),
                      ]}
                    />
                  </div>
                ) : (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
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

                    <div>
                      <Typography.Text type="secondary">File KPI kế hoạch tháng</Typography.Text>
                      <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 8 }}>
                        <Space wrap size={8}>
                          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                            Tải file kế hoạch mẫu
                          </Button>
                          <Upload
                            accept=".xlsx"
                            maxCount={1}
                            showUploadList={false}
                            beforeUpload={(file) => {
                              setPlanFile(file)
                              setResult(null)
                              setError(null)
                              return false
                            }}
                            onRemove={() => {
                              setPlanFile(null)
                              setResult(null)
                            }}
                            fileList={
                              planFile
                                ? [
                                    {
                                      uid: 'plan-workbook',
                                      name: planFile.name,
                                      status: 'done',
                                    } as UploadFile
                                  ]
                                : []
                            }
                          >
                            <Button type="primary" ghost icon={<UploadOutlined />}>
                              Chọn file KPI đã điền kế hoạch
                            </Button>
                          </Upload>
                        </Space>

                        {planFile ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              padding: '10px 12px',
                              borderRadius: 10,
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            <Space size={10}>
                              <FileExcelOutlined />
                              <div>
                                <Typography.Text strong style={{ display: 'block' }}>
                                  File đã chọn
                                </Typography.Text>
                                <Typography.Text type="secondary">{planFile.name}</Typography.Text>
                              </div>
                            </Space>

                            <Button
                              type="text"
                              icon={<CloseOutlined />}
                              aria-label="Bỏ file đã chọn"
                              onClick={() => {
                                setPlanFile(null)
                                setResult(null)
                              }}
                            />
                          </div>
                        ) : (
                          <Typography.Text type="secondary">
                            Chưa có file nào được chọn.
                          </Typography.Text>
                        )}
                      </Space>
                    </div>

                    <Alert
                      type="info"
                      showIcon
                      message="Sheet bắt buộc: Kế hoạch Developer"
                      description="Mỗi dòng là 1 mã Jira. Cột bắt buộc: Mã Jira, Tên công việc, Loại kế hoạch. Cột khuyến nghị: Hạn dự kiến, Điểm khối lượng, Ghi chú / lý do loại trừ."
                    />
                  </Space>
                )}

                <Alert
                  type="info"
                  showIcon
                  message={requiresWorkbook ? '3 bước để tính KPI tháng' : 'Điều kiện để tính KPI'}
                  description={
                    <List
                      size="small"
                      dataSource={
                        requiresWorkbook
                          ? [
                              '1. Tải file kế hoạch mẫu.',
                              '2. Điền file và tải lại lên hệ thống.',
                              '3. Xem cảnh báo trước khi xuất file KPI.',
                            ]
                          : checklist.map((item) => `${item.done ? 'Đã xong' : 'Còn thiếu'}: ${item.label}`)
                      }
                      renderItem={(item) => <List.Item>{item}</List.Item>}
                    />
                  }
                />

                {!canSubmit ? (
                  <Typography.Text type="secondary">
                    Còn thiếu: {checklist.filter((item) => !item.done).map((item) => item.label).join(', ')}.
                  </Typography.Text>
                ) : null}

                {blockingWarnings.length ? (
                  <Alert
                    type="error"
                    showIcon
                    message="Cần xử lý trước khi xuất file KPI"
                    description={
                      <List
                        size="small"
                        dataSource={blockingWarnings.slice(0, 5)}
                        renderItem={(item) => (
                          <List.Item>
                            {item.issue_key ? `${item.issue_key}: ` : ''}
                            {item.message}
                          </List.Item>
                        )}
                      />
                    }
                  />
                ) : null}

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
                    disabled={!canExport}
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
              extra={result ? <Typography.Text type="secondary">Bộ máy tính: {result.agent}</Typography.Text> : null}
            >
              {error ? (
                <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
              ) : null}

              {!result && !error ? (
                <Typography.Text type="secondary">
                  {requiresWorkbook
                    ? 'Chọn tháng, đính kèm file KPI có sheet Kế hoạch Developer rồi nhấn Tính toán để đối chiếu kế hoạch với Jira.'
                    : 'Chọn sprint cụ thể rồi nhấn Tính toán để hệ thống đối chiếu công việc theo kỳ.'}
                </Typography.Text>
              ) : null}

              {stats ? (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {result?.plan_summary ? (
                    <Descriptions size="small" bordered column={1}>
                      <Descriptions.Item label="Sheet kế hoạch">
                        {result.plan_summary.sheet_name}
                      </Descriptions.Item>
                      <Descriptions.Item label="Dòng kế hoạch">
                        {result.plan_summary.total_rows}
                      </Descriptions.Item>
                      <Descriptions.Item label="Cam kết">
                        {result.plan_summary.committed_rows}
                      </Descriptions.Item>
                      <Descriptions.Item label="Khớp trên Jira">
                        {result.plan_summary.matched_issue_count}
                      </Descriptions.Item>
                      <Descriptions.Item label="Thiếu trên Jira">
                        {result.plan_summary.missing_in_jira_count}
                      </Descriptions.Item>
                      <Descriptions.Item label="Không khớp người được giao">
                        {result.plan_summary.assignee_mismatch_count}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngoài kế hoạch">
                        {result.plan_summary.unplanned_issue_count}
                      </Descriptions.Item>
                      <Descriptions.Item label="Dữ liệu Jira bị cắt ngưỡng">
                        {result.dataset_truncated ? 'Có' : 'Không'}
                      </Descriptions.Item>
                    </Descriptions>
                  ) : null}

                  <Row gutter={[12, 12]}>
                    <Col xs={12} sm={8}>
                      <Card size="small">
                        <Typography.Text type="secondary">Tổng (cam kết)</Typography.Text>
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
                    <Descriptions.Item label="Tỷ lệ cam kết (J5)">
                      {formatRate(stats.commitment_rate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Đúng hạn (J6)">
                      {formatRate(stats.schedule_rate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Nguồn đúng hạn">
                      {stats.schedule_source === 'jira_due_date'
                        ? 'Hạn trên Jira'
                        : stats.schedule_source === 'plan_due_date'
                          ? 'Hạn dự kiến từ Kế hoạch Developer'
                          : stats.schedule_source === 'mixed'
                            ? 'Kết hợp Jira và Kế hoạch Developer'
                            : 'Chưa đủ dữ liệu'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Thông lượng (J7)">
                      {formatRate(stats.throughput_rate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Nguồn thông lượng">
                      {stats.throughput_source === 'story_points'
                        ? 'Điểm story trên Jira'
                        : stats.throughput_source === 'scope_score'
                          ? 'Điểm khối lượng từ Kế hoạch Developer'
                          : 'Chưa đủ dữ liệu'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Công việc Jira đã lấy">
                      {result?.issue_count ?? 0}
                    </Descriptions.Item>
                  </Descriptions>

                  {stats.schedule_rate != null ? (
                    <Alert
                      type="info"
                      showIcon
                      message="Lưu ý về chỉ số Đúng hạn"
                      description="Hiện hệ thống dùng thời điểm cập nhật gần nhất trên Jira làm tín hiệu hoàn thành gần đúng. Nếu công việc đã hoàn thành rồi mới bị chỉnh sửa thêm, chỉ số này có thể bị lệch."
                    />
                  ) : null}

                  {warningGroups.length ? (
                    <Alert
                      type={blockingWarnings.length ? 'error' : 'warning'}
                      showIcon
                      message={blockingWarnings.length ? 'Có cảnh báo chặn export' : 'Cảnh báo đối chiếu kế hoạch'}
                      description={
                        <List
                          size="small"
                          dataSource={warningGroups}
                          renderItem={([code, items]) => (
                            <List.Item>
                              <div>
                                <Typography.Text strong>{formatWarningGroup(code)}</Typography.Text>
                                <div style={{ marginTop: 4 }}>
                                  {items.slice(0, 4).map((item, index) => (
                                    <div key={`${code}-${item.issue_key ?? item.row_number ?? index}`}>
                                      {item.blocking ? '[Chặn export] ' : '[Nhắc nhở] '}
                                      {item.issue_key ? `${item.issue_key}: ` : ''}
                                      {item.row_number ? `Dòng ${item.row_number} - ` : ''}
                                      {item.message}
                                    </div>
                                  ))}
                                  {items.length > 4 ? (
                                    <Typography.Text type="secondary">
                                      ... và thêm {items.length - 4} cảnh báo cùng loại
                                    </Typography.Text>
                                  ) : null}
                                </div>
                              </div>
                            </List.Item>
                          )}
                        />
                      }
                    />
                  ) : null}

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

                  {result?.result.trace?.length ? (
                    <Alert
                      type="info"
                      showIcon
                      message="Cách tính"
                      description={
                        <List
                          size="small"
                          dataSource={result.result.trace}
                          renderItem={(item) => <List.Item>{item}</List.Item>}
                        />
                      }
                    />
                  ) : null}

                  {result?.result.evidence?.length ? (
                    <Card size="small" title="Đối chiếu công việc (rút gọn)">
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
                                {formatEvidenceBucket(item.bucket)}
                              </Typography.Text>
                              <Typography.Text
                                type="secondary"
                                style={{ justifySelf: 'end', textAlign: 'right' }}
                              >
                                {formatEvidenceNote(item.note)}
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
