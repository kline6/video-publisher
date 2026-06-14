import { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Select, Typography, Space, Divider, Tag, Spin, message, Alert,
} from 'antd';
import {
  SettingOutlined, ApiOutlined, KeyOutlined, ThunderboltOutlined, CheckCircleOutlined,
  CloseCircleOutlined, SyncOutlined, SaveOutlined, RobotOutlined,
} from '@ant-design/icons';
import toast from 'react-hot-toast';
import { settingsApi } from '@/services';

const { Title, Text, Paragraph } = Typography;

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data } = await settingsApi.get();
      const s = data.data;
      form.setFieldsValue({
        ai_api_url: s.ai_api_url || 'https://api.openai.com/v1',
        ai_model: s.ai_model || 'gpt-4o',
      });
      setHasApiKey(!!s.ai_api_key && s.ai_api_key !== '');
      if (s.ai_available_models?.length > 0) {
        setModels(s.ai_available_models);
      }
    } catch {
      toast.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const payload: any = {
        ai_api_url: values.ai_api_url,
        ai_model: values.ai_model,
      };
      if (values.ai_api_key && values.ai_api_key !== '' && !values.ai_api_key.includes('...')) {
        payload.ai_api_key = values.ai_api_key;
      }
      if (models.length > 0) {
        payload.ai_available_models = models;
      }
      await settingsApi.update(payload);
      toast.success('设置已保存');
      loadSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const apiUrl = form.getFieldValue('ai_api_url');
    const apiKey = form.getFieldValue('ai_api_key');
    if (!apiKey || apiKey.includes('...')) {
      toast.error('请先输入有效的 API Key');
      return;
    }
    setTesting(true);
    setConnectionStatus('idle');
    try {
      const { data } = await settingsApi.testAi({ ai_api_url: apiUrl, ai_api_key: apiKey });
      const result = data.data;
      setConnectionStatus(result.success ? 'success' : 'error');
      toast[result.success ? 'success' : 'error'](result.message);
    } catch (err: any) {
      setConnectionStatus('error');
      toast.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleFetchModels = async () => {
    const apiUrl = form.getFieldValue('ai_api_url');
    const apiKey = form.getFieldValue('ai_api_key');
    if (!apiKey || apiKey.includes('...')) {
      toast.error('请先输入有效的 API Key');
      return;
    }
    setFetchingModels(true);
    try {
      const { data } = await settingsApi.fetchModels({ ai_api_url: apiUrl, ai_api_key: apiKey });
      const result = data.data;
      if (result.success && result.models?.length > 0) {
        setModels(result.models);
        toast.success(`获取到 ${result.models.length} 个模型`);
      } else {
        toast.error(result.message || '未获取到模型列表');
      }
    } catch {
      toast.error('获取模型列表失败');
    } finally {
      setFetchingModels(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>⚙️ 设置</Title>

      <Card title={<Space><RobotOutlined /> AI 模型配置</Space>} style={{ marginBottom: 24 }}>
        <Paragraph type="secondary">
          配置你的 AI API 接入信息。支持 OpenAI 兼容接口（如 OpenAI、DeepSeek、Moonshot、Claude 等）。
          配置后，AI 助手页面的所有功能将使用你指定的模型。
        </Paragraph>

        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item label="API URL" name="ai_api_url" tooltip="OpenAI 兼容接口地址">
            <Input
              prefix={<ApiOutlined />}
              placeholder="https://api.openai.com/v1"
            />
          </Form.Item>

          <Form.Item label="API Key" name="ai_api_key" tooltip="你的 API 密钥（保存后会加密存储）">
            <Input.Password
              prefix={<KeyOutlined />}
              placeholder={hasApiKey ? '已设置（留空则保持原有 Key）' : 'sk-...'}
            />
          </Form.Item>

          <Space style={{ marginBottom: 24 }}>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={handleTestConnection}
              loading={testing}
            >
              测试连接
            </Button>
            <Button
              icon={<SyncOutlined spin={fetchingModels} />}
              onClick={handleFetchModels}
              loading={fetchingModels}
            >
              获取模型列表
            </Button>
            {connectionStatus === 'success' && <Tag color="success" icon={<CheckCircleOutlined />}>连接成功</Tag>}
            {connectionStatus === 'error' && <Tag color="error" icon={<CloseCircleOutlined />}>连接失败</Tag>}
          </Space>

          <Form.Item label="选择模型" name="ai_model" tooltip="选择 AI 生成使用的模型">
            <Select
              showSearch
              placeholder="选择模型"
              options={models.map(m => ({ value: m, label: m }))}
              notFoundContent="点击上方「获取模型列表」加载可选模型"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          {models.length > 0 && (
            <Alert
              type="info"
              showIcon
              message={`已加载 ${models.length} 个可选模型`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} size="large">
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="📖 使用说明">
        <Paragraph>
          <ul>
            <li><strong>OpenAI</strong>: API URL 填 <code>https://api.openai.com/v1</code>，Key 填你的 OpenAI API Key</li>
            <li><strong>DeepSeek</strong>: API URL 填 <code>https://api.deepseek.com/v1</code>，Key 填 DeepSeek Key</li>
            <li><strong>Moonshot (Kimi)</strong>: API URL 填 <code>https://api.moonshot.cn/v1</code></li>
            <li><strong>其他兼容接口</strong>: 只要支持 OpenAI Chat Completions 格式的均可</li>
          </ul>
        </Paragraph>
        <Paragraph type="secondary">
          如果不配置，系统将使用本地模板生成（无需 API Key，但内容质量有限）。
        </Paragraph>
      </Card>
    </div>
  );
}

