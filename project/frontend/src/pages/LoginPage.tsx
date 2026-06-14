import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space } from 'antd';
import { VideoCameraOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      toast.success('登录成功');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 420, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <VideoCameraOutlined style={{ fontSize: 48, color: '#3B82F6' }} />
            <Title level={3} style={{ marginTop: 8, marginBottom: 0 }}>VideoFlow</Title>
            <Text type="secondary">视频发布与流量增长平台</Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} size="large" style={{ textAlign: 'left' }}>
            <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效邮箱' }]}>
              <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>
          </Form>

          <Text>
            还没有账号？ <Link to="/register">立即注册</Link>
          </Text>
        </Space>
      </Card>
    </div>
  );
}
