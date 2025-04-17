import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Layout,
  Menu,
  theme,
  Avatar,
  Dropdown,
  Space,
  Badge,
  Button
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  TeamOutlined,
  FileTextOutlined,
  SearchOutlined,
  CloudUploadOutlined,
  GlobalOutlined,
  MailOutlined,
  DatabaseOutlined,
  ApiOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

const AdminLayout: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const location = useLocation();

  const items: MenuProps['items'] = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/admin">Dashboard</Link>,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <Link to="/admin/users">Users</Link>,
    },
    {
      key: 'roles',
      icon: <TeamOutlined />,
      label: <Link to="/admin/roles">Roles</Link>,
    },
    {
      key: 'reports',
      icon: <FileTextOutlined />,
      label: <Link to="/admin/reports">Reports</Link>,
    },
    {
      key: 'search',
      icon: <SearchOutlined />,
      label: <Link to="/admin/search">Search</Link>,
    },
    {
      key: 'files',
      icon: <CloudUploadOutlined />,
      label: <Link to="/admin/files">Files</Link>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <Link to="/admin/settings">Settings</Link>,
    },
    {
      key: 'localization',
      icon: <GlobalOutlined />,
      label: <Link to="/admin/localization">Localization</Link>,
    },
    {
      key: 'communications',
      icon: <MailOutlined />,
      label: <Link to="/admin/communications">Communications</Link>,
    },
    {
      key: 'backups',
      icon: <DatabaseOutlined />,
      label: <Link to="/admin/backups">Backups</Link>,
    },
    {
      key: 'integrations',
      icon: <ApiOutlined />,
      label: <Link to="/admin/integrations">Integrations</Link>,
    },
    {
      key: 'monitoring',
      icon: <LineChartOutlined />,
      label: <Link to="/admin/monitoring">Monitoring</Link>,
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="light">
        <div style={{ height: 32, margin: 16, background: 'rgba(0, 0, 0, 0.2)' }} />
        <Menu
          mode="inline"
          defaultSelectedKeys={[location.pathname.split('/')[2] || 'dashboard']}
          items={items}
          style={{ height: '100%', borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Space size="large">
            <Badge count={5}>
              <Button type="text" icon={<BellOutlined style={{ fontSize: '16px' }} />} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space>
                <Avatar icon={<UserOutlined />} />
                <span>Admin User</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout; 