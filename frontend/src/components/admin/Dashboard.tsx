import React from 'react';
import { Row, Col, Card, Statistic, Table, Progress } from 'antd';
import {
  UserOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const Dashboard: React.FC = () => {
  const recentActivities = [
    {
      key: '1',
      type: 'user',
      description: 'New user registration',
      time: '2 minutes ago',
      status: 'success'
    },
    {
      key: '2',
      type: 'order',
      description: 'New order placed',
      time: '5 minutes ago',
      status: 'success'
    },
    {
      key: '3',
      type: 'system',
      description: 'System backup completed',
      time: '1 hour ago',
      status: 'success'
    },
    {
      key: '4',
      type: 'warning',
      description: 'High server load detected',
      time: '2 hours ago',
      status: 'warning'
    }
  ];

  const columns = [
    {
      title: 'Activity',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Time',
      dataIndex: 'time',
      key: 'time',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        status === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
        status === 'warning' ? <WarningOutlined style={{ color: '#faad14' }} /> :
        <ClockCircleOutlined style={{ color: '#1890ff' }} />
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={1128}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Orders"
              value={93}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Revenue"
              value={112893}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="System Health"
              value={98}
              suffix="%"
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="System Resources">
            <div style={{ marginBottom: 16 }}>
              <div>CPU Usage</div>
              <Progress percent={65} status="active" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div>Memory Usage</div>
              <Progress percent={45} status="normal" />
            </div>
            <div>
              <div>Disk Usage</div>
              <Progress percent={78} status="exception" />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Recent Activities">
            <Table
              dataSource={recentActivities}
              columns={columns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 