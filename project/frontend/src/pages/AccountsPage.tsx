import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Button, Tag, Avatar, Space, Typography, Empty, Popconfirm, Spin,
  Steps, Modal, Form, Input, Tooltip, Divider, Alert,
} from 'antd';
import {
  LinkOutlined, DeleteOutlined, CheckCircleOutlined,
  ReloadOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import toast from 'react-hot-toast';
import { platformApi } from '@/services';
import { PlatformAccount, PLATFORM_LABELS, PLATFORM_COLORS, Platform } from '@/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SUPPORTED_PLATFORMS: { key: Platform; name: string; desc: string; features: string[]; bindType: 'cookie' | 'oauth' | 'cookie-did' }[] = [
  { key: 'bilibili', name: 'B站', desc: '中长视频 — Cookie绑定，支持真实发布', features: ['视频投稿', '数据统计'], bindType: 'cookie' },
  { key: 'douyin', name: '抖饯', desc: '短视频 — 扫码登录/用分绑定', features: ['视频发布', '数据分析'], bindType: 'cookie' },
  { key: 'kuaishou', name: '快手', desc: '短视频 — Cookie+DID绑定', features: ['视频发布', '数据分析'], bindType: 'cookie-did' },
  { key: 'youtube', name: 'YouTube', desc: '全球视频平台 — 需OAuth配置', features: ['视频上传', '频道分析'], bindType: 'oauth' },
  { key: 'weixin', name: '视频号', desc: '微信生态 — 需OAuth配置', features: ['视频发布', '公众号联动'], bindType: 'oauth' },
  { key: 'tiktok', name: 'TikTok', desc: '海外短视频 — 需OAuth配置', features: ['视频发布', '标签优化'], bindType: 'oauth' },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindingPlatform, setBindingPlatform] = useState<string | null>(null);
  const [bilibiliModalOpen, setBilibiliModalOpen] = useState(false);
  const [douyinModalOpen, setDouyinModalOpen] = useState(false);
  const [douyinQrLoading, setDouyinQrLoading] = useState(false);
  const [kuaishouModalOpen, setKuaishouModalOpen] = useState(false);
  const [biliForm] = Form.useForm();
  const [douyinForm] = Form.useForm();
  const [kuaishouForm] = Form.useForm();

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const { data } = await platformApi.getAccounts();
      setAccounts(data.data);
    } catch { toast.error('加载账号失败'); }
    finally { setLoading(false); }
  };

  const handleBind = async (platform: Platform, bindType: string) => {
    if (platform === 'bilibili' && bindType === 'cookie') { biliForm.resetFields(); setBilibiliModalOpen(true); return; }
    if (platform === 'douyin') { douyinForm.resetFields(); setDouyinModalOpen(true); return; }
    if (platform === 'kuaishou' && bindType === 'cookie-did') { kuaishouForm.resetFields(); setKuaishouModalOpen(true); return; }
    // OAuth
    setBindingPlatform(platform);
    try {
      const { data } = await platformApi.getAuthUrl(platform);
      window.open(data.data.url, '_blank', 'width=600,height=700');
      toast.success('请在弹出窗口中完成授权');
    } catch (err: any) { toast.error(err.response?.data?.error || '该平台需要先配置 OAuth'); }
    finally { setBindingPlatform(null); }
  };

  const handleBilibiliBind = async (values: any) => {
    setBindingPlatform('bilibili');
    try { await platformApi.bindBilibili(values); toast.success('B站绑定成功！'); setBilibiliModalOpen(false); loadAccounts(); }
    catch (err: any) { toast.error(err.response?.data?.error || '绑定失败'); }
    finally { setBindingPlatform(null); }
  };

  const handleDouyinBind = async (values: any) => {
    setBindingPlatform('douyin');
    try {
      toast.loading('正在绑定抖音账号...', { id: 'douyin-bind' });
      // Cookie 验证由后端完成，避免前端 CORS 问题
      await platformApi.bindDouyin({ cookie: values.cookie });
      toast.success('抖音绑定成功！', { id: 'douyin-bind' });
      setDouyinModalOpen(false);
      loadAccounts();
    } catch (err: any) { toast.error(err.response?.data?.error || '绑定失败', { id: 'douyin-bind' }); }
    finally { setBindingPlatform(null); }
  };

  const handleDouyinQrLogin = async () => {
    setDouyinQrLoading(true);
    try {
      toast.loading('正在启动抖音扫码登录...', { id: 'douyin-qr' });
      await platformApi.douyinQrLogin();
      toast.success('抖音扫码登录成功！', { id: 'douyin-qr' });
      loadAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '扫码登录失败', { id: 'douyin-qr' });
    } finally {
      setDouyinQrLoading(false);
    }
  };

  const handleKuaishouBind = async (values: any) => {
    setBindingPlatform('kuaishou');
    try { await platformApi.bindKuaishou(values); toast.success('快手绑定成功！'); setKuaishouModalOpen(false); loadAccounts(); }
    catch (err: any) { toast.error(err.response?.data?.error || '绑定失败'); }
    finally { setBindingPlatform(null); }
  };

  const handleReauth = async (platform: Platform) => {
    if (platform === 'bilibili') { biliForm.resetFields(); setBilibiliModalOpen(true); return; }
    if (platform === 'douyin') { douyinForm.resetFields(); setDouyinModalOpen(true); return; }
    if (platform === 'kuaishou') { kuaishouForm.resetFields(); setKuaishouModalOpen(true); return; }
    try { const { data } = await platformApi.getAuthUrl(platform); window.open(data.data.url, '_blank', 'width=600,height=700'); }
    catch (err: any) { toast.error(err.response?.data?.error || '获取授权链接失败'); }
  };

  const handleUnbind = async (id: number) => {
    try { await platformApi.deleteAccount(id); toast.success('已解绑'); loadAccounts(); }
    catch { toast.error('解绑失败'); }
  };

  const boundPlatforms = new Set(accounts.map((a) => a.platform));

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>🔗 账号管理</Title>

      <Card style={{ marginBottom: 24 }}>
        <Alert type="info" showIcon message="B站/抖音/快手支持 Cookie 绑定。其他平台需配置 OAuth。" style={{ marginBottom: 16 }} />
        <Title level={5}>📌 绑定指引</Title>
        <Steps items={[
          { title: '选择平台', description: '点击「绑定」按钮' },
          { title: '粘贴 Cookie', description: '从浏览器开发者工具中复制' },
          { title: '完成', description: '验证成功后即可使用' },
        ]} style={{ marginTop: 16 }} />
      </Card>

      {accounts.length > 0 && (
        <Card title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /> 已绑定账号</Space>} style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {accounts.map((account) => (
              <Col xs={24} sm={12} md={8} key={account.id}>
                <Card size="small" hoverable style={{ borderLeft: '4px solid ' + (PLATFORM_COLORS[account.platform as Platform] || '#999') }}>
                  <Space style={{ marginBottom: 8 }}>
                    <Avatar style={{ backgroundColor: PLATFORM_COLORS[account.platform as Platform] }}>{(PLATFORM_LABELS[account.platform as Platform] || '?')[0]}</Avatar>
                    <div>
                      <Text strong>{account.nickname || PLATFORM_LABELS[account.platform as Platform]}</Text>
                      <br /><Tag color="green" icon={<CheckCircleOutlined />}>已连接</Tag>
                    </div>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}><ClockCircleOutlined /> {account.created_at ? new Date(account.created_at).toLocaleDateString() : '-'}</Text>
                  <Space>
                    <Button size="small" icon={<ReloadOutlined />} onClick={() => handleReauth(account.platform as Platform)}>重新绑定</Button>
                    <Popconfirm title="确定解绑？" onConfirm={() => handleUnbind(account.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />}>解绑</Button>
                    </Popconfirm>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card title={<Space><LinkOutlined /> 支持的平台</Space>} extra={<Text type="secondary">已绑定 {boundPlatforms.size} 个</Text>}>
        <Row gutter={[16, 16]}>
          {SUPPORTED_PLATFORMS.map((platform) => {
            const isBound = boundPlatforms.has(platform.key);
            return (
              <Col xs={24} sm={12} md={8} key={platform.key}>
                <Card size="small" hoverable style={{ opacity: isBound ? 0.65 : 1, borderTop: '3px solid ' + (PLATFORM_COLORS[platform.key] || '#999') }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Space>
                      <Avatar style={{ backgroundColor: PLATFORM_COLORS[platform.key] }}>{platform.name[0]}</Avatar>
                      <div><Text strong>{platform.name}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{platform.desc}</Text></div>
                    </Space>
                    {isBound ? <Tag color="green" icon={<CheckCircleOutlined />}>已绑定</Tag> :
                      <Button type="primary" size="small" icon={<LinkOutlined />} loading={bindingPlatform === platform.key} onClick={() => handleBind(platform.key, platform.bindType)}>绑定</Button>}
                  </Space>
                  {platform.features.map((f) => <Tag key={f} style={{ fontSize: 11, marginBottom: 2 }}>{f}</Tag>)}
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* B站 Cookie 绑定 */}
      <Modal title="B站账号绑定" open={bilibiliModalOpen} onCancel={() => setBilibiliModalOpen(false)} onOk={() => biliForm.submit()} confirmLoading={bindingPlatform === 'bilibili'} width={600}>
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="获取B站Cookie" description={<div><p>1. 登录 bilibili.com</p><p>2. F12 → Application → Cookies</p><p>3. 复制 SESSDATA、bili_jct、DedeUserID</p></div>} />
        <Form form={biliForm} layout="vertical" onFinish={handleBilibiliBind}>
          <Form.Item label="SESSDATA" name="sessdata" rules={[{ required: true }]}><Input.Password placeholder="SESSDATA值" /></Form.Item>
          <Form.Item label="bili_jct" name="bili_jct" rules={[{ required: true }]}><Input.Password placeholder="bili_jct值" /></Form.Item>
          <Form.Item label="DedeUserID（可选）" name="dedeuserid"><Input placeholder="DedeUserID值" /></Form.Item>
        </Form>
      </Modal>

      {/* 抖音 Cookie 绑定 */}
      {/* 抖饯绑定 — 扫码登录 + Cookie绑定 */}
      <Modal
        title="抖饯账号绑定"
        open={douyinModalOpen}
        onCancel={() => setDouyinModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>推荐：扫码登录（自动获取完整登录态）</Title>
          <Text type="secondary">点击下方按钮后，会弹出抖饯创作者平台登录页面，请使用抖饯APP扫码登录。</Text>
          <br />
          <Button
            type="primary"
            size="large"
            loading={douyinQrLoading}
            onClick={handleDouyinQrLogin}
            style={{ marginTop: 12 }}
          >
            启动抖饯扫码登录
          </Button>
        </div>
        <Divider>或者</Divider>
        <Title level={5}>Cookie 绑定（快速，但可能无法发布）</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Cookie绑定仅用于数据查看，发布功能需要扫码登录方式。</Text>
        <Form form={douyinForm} layout="vertical" onFinish={handleDouyinBind}>
          <Form.Item label="完整Cookie" name="cookie" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="粘贴完整的Cookie字符串（包含sessionid等）" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={bindingPlatform === 'douyin'}>
              绑定Cookie
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 快手 Cookie 绑定 */}
      <Modal title="快手账号绑定" open={kuaishouModalOpen} onCancel={() => setKuaishouModalOpen(false)} onOk={() => kuaishouForm.submit()} confirmLoading={bindingPlatform === 'kuaishou'} width={600}>
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="获取快手Cookie和DID" description={<div><p>1. 登录 kuaishou.com</p><p>2. F12 → Application → Cookies → kuaishou.com</p><p>3. 复制完整Cookie和DID值</p></div>} />
        <Form form={kuaishouForm} layout="vertical" onFinish={handleKuaishouBind}>
          <Form.Item label="完整Cookie" name="cookie" rules={[{ required: true }]}><TextArea rows={4} placeholder="粘贴完整的Cookie字符串" /></Form.Item>
          <Form.Item label="DID" name="did" rules={[{ required: true }]}><Input placeholder="DID值（从Cookie中复制did字段）" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
