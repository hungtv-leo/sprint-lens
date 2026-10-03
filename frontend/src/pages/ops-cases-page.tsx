import { CheckOutlined, CustomerServiceOutlined, DownloadOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'

import { PageBody } from '../components/layout/page-body'
import { TopBar } from '../components/layout/top-bar'
import { useAppConfig, useProjects, useUsers } from '../hooks/jira-hooks'
import { useCreateOpsCase, useOpsCaseStats, useOpsCases, useOpsWorkTypes } from '../hooks/ops-hooks'
import { useLocalStorage } from '../hooks/use-local-storage'
import { exportOpsCases, userFilterValue } from '../lib/api'
import type { OpsCaseItem, OpsHandlerStat, OpsWorkTypeStat } from '../lib/types'

function formatCreatedAt(value: string) {
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('DD/MM/YYYY HH:mm') : value
}

export function OpsCasesPage() {
  const [handler, setHandler] = useLocalStorage<string>('sprint-lens.ops-handler', '')
  const [workType, setWorkType] = useState<string>('')
  const [month, setMonth] = useState<Dayjs>(dayjs())
  const [exporting, setExporting] = useState(false)

  const projectsQuery = useProjects()
  const configQuery = useAppConfig()

  const userProjects = useMemo(() => {
    const defaults = configQuery.data?.default_projects ?? []
    if (defaults.length > 0) return defaults
    return (projectsQuery.data ?? []).map((project) => project.key)
  }, [configQuery.data?.default_projects, projectsQuery.data])

  const usersQuery = useUsers(userProjects)
  const workTypesQuery = useOpsWorkTypes()
  const monthKey = month.format('YYYY-MM')
  const casesQuery = useOpsCases({ month: monthKey, limit: 50 })
  const statsQuery = useOpsCaseStats(monthKey)
  const createMutation = useCreateOpsCase()

  const selectedUser = useMemo(
    () => (usersQuery.data ?? []).find((user) => userFilterValue(user) === handler),
    [handler, usersQuery.data],
  )

  const canSubmit = Boolean(handler.trim()) && Boolean(workType) && !createMutation.isPending

  async function handleSubmit() {
    if (!canSubmit) {
      message.warning('Chọn người xử lý và loại công việc')
      return
    }
    try {
      await createMutation.mutateAsync({
        handler: selectedUser ? userFilterValue(selectedUser) : handler.trim(),
        handler_display_name: selectedUser?.display_name ?? handler.trim(),
        work_type: workType,
      })
      message.success('Đã ghi nhận case đã support')
      setWorkType('')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Không ghi nhận được case'
      message.error(text)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await exportOpsCases(monthKey)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ops_cases_${monthKey}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
      message.success('Đã xuất dữ liệu vận hành')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Không xuất được dữ liệu'
      message.error(text)
    } finally {
      setExporting(false)
    }
  }

  const caseColumns: ColumnsType<OpsCaseItem> = [
    {
      title: 'Thời điểm',
      dataIndex: 'created_at',
      width: 160,
      render: (value: string) => formatCreatedAt(value),
    },
    {
      title: 'Người xử lý',
      dataIndex: 'handler_display_name',
    },
    {
      title: 'Loại công việc',
      dataIndex: 'work_type_label',
    },
  ]

  const handlerColumns: ColumnsType<OpsHandlerStat> = [
    {
      title: 'Nhân viên',
      dataIndex: 'handler_display_name',
    },
    {
      title: 'Số case',
      dataIndex: 'total',
      width: 100,
      align: 'right',
    },
  ]

  const workTypeColumns: ColumnsType<OpsWorkTypeStat> = [
    {
      title: 'Loại công việc',
      dataIndex: 'work_type_label',
    },
    {
      title: 'Số case',
      dataIndex: 'total',
      width: 100,
      align: 'right',
    },
  ]

  return (
    <div>
      <TopBar
        title="Vận hành — Ghi nhận case"
        description="Chọn người xử lý và loại case đã support, rồi lưu. Mỗi lần lưu = 1 case đã xong."
        onRefresh={() => {
          void casesQuery.refetch()
          void statsQuery.refetch()
          void usersQuery.refetch()
        }}
        refreshing={casesQuery.isFetching || statsQuery.isFetching || usersQuery.isFetching}
      />
      <PageBody>
        {usersQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Không tải được danh sách người xử lý từ Jira"
            description="Kiểm tra kết nối Jira hoặc cấu hình project mặc định."
          />
        ) : null}

        <Card
          title={
            <Space>
              <CustomerServiceOutlined />
              <span>Ghi nhận nhanh</span>
            </Space>
          }
        >
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Typography.Text type="secondary">Người xử lý</Typography.Text>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                style={{ width: '100%', marginTop: 6 }}
                placeholder="Chọn người xử lý"
                value={handler || undefined}
                onChange={(value) => setHandler(value ?? '')}
                loading={usersQuery.isFetching || projectsQuery.isFetching || configQuery.isFetching}
                options={(usersQuery.data ?? []).map((user) => ({
                  value: userFilterValue(user),
                  label: user.display_name,
                }))}
                notFoundContent={
                  usersQuery.isError
                    ? 'Không tải được danh sách người dùng'
                    : userProjects.length === 0
                      ? 'Đang tải danh sách…'
                      : 'Không có dữ liệu'
                }
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text type="secondary">Loại công việc đã support</Typography.Text>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                style={{ width: '100%', marginTop: 6 }}
                placeholder="Chọn loại"
                value={workType || undefined}
                onChange={(value) => setWorkType(value ?? '')}
                loading={workTypesQuery.isFetching}
                options={(workTypesQuery.data ?? []).map((item) => ({
                  value: item.code,
                  label: item.label,
                }))}
              />
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              disabled={!canSubmit}
              loading={createMutation.isPending}
              onClick={() => void handleSubmit()}
            >
              Ghi nhận đã support
            </Button>
          </div>
        </Card>

        <Card
          title="Thống kê theo tháng"
          extra={
            <Space wrap>
              <DatePicker
                picker="month"
                value={month}
                onChange={(value) => setMonth(value ?? dayjs())}
                allowClear={false}
                format="MM/YYYY"
              />
              <Button
                icon={<DownloadOutlined />}
                loading={exporting}
                onClick={() => void handleExport()}
              >
                Xuất Excel
              </Button>
            </Space>
          }
        >
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            Tổng tháng {month.format('MM/YYYY')}: <strong>{statsQuery.data?.total ?? 0}</strong> case
          </Typography.Paragraph>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Table
                size="small"
                rowKey="handler"
                loading={statsQuery.isFetching}
                pagination={false}
                columns={handlerColumns}
                dataSource={statsQuery.data?.by_handler ?? []}
                locale={{ emptyText: 'Chưa có case trong tháng này' }}
              />
            </Col>
            <Col xs={24} lg={12}>
              <Table
                size="small"
                rowKey="work_type"
                loading={statsQuery.isFetching}
                pagination={false}
                columns={workTypeColumns}
                dataSource={statsQuery.data?.by_work_type ?? []}
                locale={{ emptyText: 'Chưa có case trong tháng này' }}
              />
            </Col>
          </Row>
        </Card>

        <Card title={`Case gần đây (${month.format('MM/YYYY')})`}>
          <Table
            size="small"
            rowKey="id"
            loading={casesQuery.isFetching}
            columns={caseColumns}
            dataSource={casesQuery.data?.items ?? []}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{ emptyText: 'Chưa có case nào được ghi nhận' }}
          />
        </Card>
      </PageBody>
    </div>
  )
}
