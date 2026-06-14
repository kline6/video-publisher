import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Button, Space, Typography, Input, Badge, Tooltip } from 'antd';
import {
  DashboardOutlined,
  SendOutlined,
  UserSwitchOutlined,
  CalendarOutlined,
  RocketOutlined,
  RobotOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  VideoCameraOutlined,
  BellOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '数据看板' },
  { key: '/publish', icon: <SendOutlined />, label: '视频发布' },
  { key: '/accounts', icon: <UserSwitchOutlined />, label: '账号管理' },
  { key: '/calendar', icon: <CalendarOutlined />, label: '内容日历' },
  { key: '/traffic', icon: <RocketOutlined />, label: '流量实验室' },
  { key: '/ai', icon: <RobotOutlined />, label: 'AI 助手' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const userMenuItems = [
    { key: 'profile', label: '个人资料' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleUserMenu = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#001529',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Space>
            <VideoCameraOutlined style={{ fontSize: 24, color: '#3B82F6' }} />
            {!collapsed && <Text strong style={{ color: '#fff', fontSize: 16 }}>VideoFlow</Text>}
          </Space>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, flex: 1 }}
        />
        {/* 版本号 */}
        <div style={{
          padding: '12px 16px',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.35)',
          fontSize: 12,
        }}>
          {collapsed ? 'v1' : 'VideoFlow v1.0.0'}
        </div>
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />

          <Space size={16}>
            {/* 全局搜索框 */}
            <Input
              placeholder="搜索..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{ width: 220, borderRadius: 16 }}
              allowClear
            />

            {/* 通知铃铛 */}
            <Tooltip title="通知">
              <Badge count={0} size="small">
                <Button
                  type="text"
                  icon={<BellOutlined style={{ fontSize: 18 }} />}
                  style={{ color: '#595959' }}
                />
              </Badge>
            </Tooltip>

            {/* 用户下拉 */}
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenu }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" style={{ backgroundColor: '#3B82F6' }}>
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </Avatar>
                <Text>{user?.username || 'User'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 24, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

