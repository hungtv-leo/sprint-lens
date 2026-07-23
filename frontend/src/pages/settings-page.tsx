import { Card, Col, Descriptions, Grid, List, Row, Steps, Typography } from 'antd'

import { PageBody } from '../components/layout/page-body'

const { useBreakpoint } = Grid

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export function SettingsPage() {
  const screens = useBreakpoint()
  const isMobile = !screens.md

  return (
    <PageBody>
      <div>
        <Typography.Text type="secondary">Thiết lập hệ thống</Typography.Text>
        <Typography.Title level={isMobile ? 3 : 2} style={{ marginTop: 8 }}>
          Cài đặt
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ maxWidth: 640 }}>
          Cấu hình cơ bản cho Sprint Lens và hướng dẫn nối Jira API an toàn qua backend FastAPI.
        </Typography.Paragraph>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={14}>
          <Card size={isMobile ? 'small' : 'default'} title="API frontend">
            <Typography.Paragraph copyable style={{ wordBreak: 'break-all' }}>
              {API_BASE_URL}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              Frontend sẽ gọi về backend thông qua biến `VITE_API_BASE_URL`.
            </Typography.Text>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card size={isMobile ? 'small' : 'default'} title="Biến môi trường backend">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Base URL">JIRA_BASE_URL</Descriptions.Item>
              <Descriptions.Item label="Token">JIRA_PERSONAL_ACCESS_TOKEN</Descriptions.Item>
              <Descriptions.Item label="Project mặc định">JIRA_DEFAULT_PROJECTS</Descriptions.Item>
              <Descriptions.Item label="Cache">CACHE_TTL_SECONDS</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card size={isMobile ? 'small' : 'default'} title="Quy trình triển khai">
            <Steps
              direction="vertical"
              size="small"
              current={-1}
              items={[
                { title: 'Tạo file `.env` trong thư mục `backend/` từ `backend/.env.example`.' },
                { title: 'Điền `JIRA_BASE_URL` và `JIRA_PERSONAL_ACCESS_TOKEN`.' },
                { title: 'Tạo file `.env` trong `frontend/` nếu cần đổi `VITE_API_BASE_URL`.' },
                {
                  title:
                    'Chạy backend trước, sau đó mở frontend để bắt đầu lọc theo project.',
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card size={isMobile ? 'small' : 'default'} title="Lưu ý">
            <List
              size="small"
              dataSource={[
                'Token Jira chỉ nằm ở backend, không đẩy xuống trình duyệt.',
                '`JIRA_DEFAULT_PROJECTS` có thể bỏ trống nếu muốn chọn project bằng giao diện.',
                'Bảng hiện tại là chỉ đọc, phù hợp giai đoạn quan sát và điều phối.',
              ]}
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
          </Card>
        </Col>
      </Row>
    </PageBody>
  )
}
