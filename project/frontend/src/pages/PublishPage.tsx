import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space, DatePicker, Typography, Row, Col,
  Tooltip, Popconfirm, Empty, Badge, Progress, Descriptions, Divider, Alert, Upload,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoadingOutlined, ClockCircleOutlined, SendOutlined, ThunderboltOutlined, ExclamationCircleOutlined,
  ReloadOutlined, InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { publishApi, aiApi, uploadApi } from '@/services';
import { PublishTask, PLATFORM_LABELS, PLATFORM_COLORS, Platform, TaskStatus } from '@/types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_MAP: Record<TaskStatus, { color: string; text: string; icon: React.ReactNode }> = {
  pending: { color: 'default', text: '等待中', icon: <ClockCircleOutlined /> },
  processing: { color: 'processing', text: '处理中', icon: <LoadingOutlined /> },
  scheduled: { color: 'warning', text: '已排期', icon: <ClockCircleOutlined /> },
  publishing: { color: 'processing', text: '发布中', icon: <LoadingOutlined /> },
  success: { color: 'success', text: '成功', icon: <CheckCircleOutlined /> },
  failed: { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
  partial: { color: 'warning', text: '部分成功', icon: <ExclamationCircleOutlined /> },
};

export default function PublishPage() {
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PublishTask | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  useEffect(() => { loadTasks(); }, [pagination.current]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { data } = await publishApi.getTasks({ page: pagination.current, limit: pagination.pageSize });
      setTasks(data.data);
      setPagination((prev) => ({ ...prev, total: data.pagination?.total || 0 }));
    } catch {
      toast.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const payload = {
        ...values,
        tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        scheduled_at: values.scheduled_at ? values.scheduled_at.toISOString() : undefined,
      };
      await publishApi.createTask(payload);
      toast.success('发布任务已创建');
      setModalOpen(false);
      form.resetFields();
      loadTasks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await publishApi.deleteTask(id);
      toast.success('已删除');
      loadTasks();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleViewDetail = (task: PublishTask) => {
    setSelectedTask(task);
    setDetailModalOpen(true);
  };

  const handleAiTitle = async () => {
    const topic = form.getFieldValue('description') || form.getFieldValue('title');
    if (!topic) { toast.error('请先填写视频简介或主题'); return; }
    setAiLoading(true);
    try {
      const { data } = await aiApi.generateTitles({ topic, count: 3 });
      const titles = data.data.titles;
      if (titles?.length > 0) {
        form.setFieldsValue({ title: titles[0] });
        toast.success(`AI 已生成 ${titles.length} 个标题，已选最佳标题`);
      }
    } catch {
      toast.error('AI 生成失败，请稍后重试');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiTags = async () => {
    const title = form.getFieldValue('title');
    if (!title) { toast.error('请先填写标题'); return; }
    setAiLoading(true);
    try {
      const { data } = await aiApi.generateTags({ title });
      const tags = data.data.tags;
      form.setFieldsValue({ tags: tags.join(', ') });
      toast.success('AI 已生成标签');
    } catch {
      toast.error('AI 生成失败');
    } finally {
      setAiLoading(false);
    }
  };

  const columns: ColumnsType<PublishTask> = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      width: 220,
      render: (text: string, record: PublishTask) => (
        <Button type="link" style={{ padding: 0, height: 'auto', maxWidth: 200 }} onClick={() => handleViewDetail(record)}>
          <Text ellipsis style={{ maxWidth: 180 }}>{text}</Text>
        </Button>
      ),
    },
    {
      title: '平台',
      dataIndex: 'platforms',
      width: 200,
      render: (platforms: Platform[]) => (
        <Space wrap size={4}>
          {platforms.map((p) => (
            <Tag key={p} color={PLATFORM_COLORS[p]} style={{ borderRadius: 4 }}>
              {PLATFORM_LABELS[p]}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: TaskStatus) => {
        const info = STATUS_MAP[status] || STATUS_MAP.pending;
        return (
          <Badge status={info.color as any} text={
            <Space size={4}>
              {info.icon}
              <span>{info.text}</span>
            </Space>
          } />
        );
      },
    },
    {
      title: '排期/发布时间',
      width: 180,
      render: (_: any, record: PublishTask) => {
        if (record.published_at) {
          return <Tooltip title={dayjs(record.published_at).format('YYYY-MM-DD HH:mm:ss')}>
            <Text type="secondary">{dayjs(record.published_at).fromNow()}</Text>
          </Tooltip>;
        }
        if (record.scheduled_at) {
          return <Tooltip title={dayjs(record.scheduled_at).format('YYYY-MM-DD HH:mm')}>
            <Text type="warning"><ClockCircleOutlined /> {dayjs(record.scheduled_at).format('MM-DD HH:mm')}</Text>
          </Tooltip>;
        }
        return <Text type="secondary">立即发布</Text>;
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 160,
      render: (tags: string[]) => (
        <Space wrap size={2}>
          {tags?.slice(0, 3).map((t, i) => <Tag key={i} style={{ margin: 0 }}>{t}</Tag>)}
          {tags?.length > 3 && <Tag>+{tags.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_: any, record: PublishTask) => (
        <Space size={4}>
          <Tooltip title="查看详情">
            <Button type="text" icon={<EyeOutlined />} size="small" onClick={() => handleViewDetail(record)} />
          </Tooltip>
          {['pending', 'scheduled', 'failed'].includes(record.status) && (
            <Popconfirm title="确定删除此任务？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
              <Tooltip title="删除">
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 统计数据
  const stats = {
    total: tasks.length,
    success: tasks.filter((t) => t.status === 'success').length,
    processing: tasks.filter((t) => ['processing', 'publishing'].includes(t.status)).length,
    scheduled: tasks.filter((t) => t.status === 'scheduled').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>🎬 视频发布</Title>
          <Text type="secondary">管理你的多平台视频发布任务</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadTasks}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} size="large">
            新建发布
          </Button>
        </Space>
      </div>

      {/* 快捷统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '全部任务', value: stats.total, color: '#3B82F6' },
          { label: '发布成功', value: stats.success, color: '#10B981' },
          { label: '处理中', value: stats.processing, color: '#F59E0B' },
          { label: '已排期', value: stats.scheduled, color: '#8B5CF6' },
          { label: '失败', value: stats.failed, color: '#EF4444' },
        ].map((s) => (
          <Col xs={12} sm={8} md={4} lg={4} key={s.label}>
            <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: s.color }}>{s.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条任务`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
          }}
          locale={{
            emptyText: (
              <Empty description={
                <div>
                  <Text>还没有发布任务</Text>
                  <br />
                  <Button type="link" onClick={() => setModalOpen(true)}>立即创建第一个任务</Button>
                </div>
              } />
            ),
          }}
        />
      </Card>

      {/* 新建任务 Modal */}
      <Modal
        title="新建发布任务"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={680}
        destroyOnClose
        okText="创建任务"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Alert
            message="提示：先填写视频简介，再使用 AI 按钮自动生成标题和标签"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="视频简介/主题" name="description">
            <TextArea rows={3} placeholder="详细描述你的视频内容，AI 会根据此内容生成标题和标签" />
          </Form.Item>

          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入视频标题' }]}>
            <Input
              placeholder="视频标题"
              size="large"
              addonAfter={
                <Tooltip title="根据简介 AI 生成高点击率标题">
                  <Button type="link" size="small" loading={aiLoading} onClick={handleAiTitle} icon={<ThunderboltOutlined />}>
                    AI 标题
                  </Button>
                </Tooltip>
              }
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item label="标签" name="tags">
                <Input
                  placeholder="标签（逗号分隔，如：美食, 教程, 咖啡）"
                  addonAfter={
                    <Tooltip title="根据标题 AI 生成 SEO 标签">
                      <Button type="link" size="small" loading={aiLoading} onClick={handleAiTags} icon={<ThunderboltOutlined />}>
                        AI 标签
                      </Button>
                    </Tooltip>
                  }
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="定时发布" name="scheduled_at" tooltip="不设置则立即发布">
                <DatePicker showTime format="MM-DD HH:mm" style={{ width: '100%' }} placeholder="选择时间" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="发布平台" name="platforms" rules={[{ required: true, message: '请选择至少一个发布平台' }]}>
            <Select
              mode="multiple"
              placeholder="选择发布平台"
              size="large"
              options={Object.entries(PLATFORM_LABELS).map(([value, label]) => ({
                value,
                label: <Space><span style={{ color: PLATFORM_COLORS[value as Platform] }}>●</span> {label}</Space>,
              }))}
            />
          </Form.Item>

          <Divider />

          <Form.Item label="视频链接" name="video_url" tooltip="支持直链 URL，后续版本将支持本地上传">
            <Upload.Dragger
              name="video"
              multiple={false}
              accept=".mp4,.mov,.avi,.mkv"
              showUploadList={false}
              customRequest={async (options: any) => {
                try {
                  const { data } = await uploadApi.upload(options.file);
                  form.setFieldsValue({ video_url: data.data.url });
                  toast.success('视频上传成功');
                } catch { toast.error('上传失败'); }
              }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽上传视频</p>
              <p className="ant-upload-hint">支持 MP4, MOV, AVI, MKV 格式，最大 500MB</p>
            </Upload.Dragger>
          </Form.Item>

          <Form.Item label="封面链接" name="cover_url" tooltip="不填写则使用视频默认封面">
            <Upload.Dragger
              name="cover"
              multiple={false}
              accept=".jpg,.jpeg,.png,.webp"
              showUploadList={false}
              customRequest={async (options: any) => {
                try {
                  const { data } = await uploadApi.upload(options.file);
                  form.setFieldsValue({ cover_url: data.data.url });
                  toast.success('封面上传成功');
                } catch { toast.error('上传失败'); }
              }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽上传封面图</p>
              <p className="ant-upload-hint">支持 JPG, PNG, WebP 格式（可选）</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务详情 Modal */}
      <Modal
        title="任务详情"
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setSelectedTask(null); }}
        footer={null}
        width={640}
      >
        {selectedTask && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="标题" span={2}>{selectedTask.title}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge
                  status={(STATUS_MAP[selectedTask.status]?.color || 'default') as any}
                  text={STATUS_MAP[selectedTask.status]?.text || selectedTask.status}
                />
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(selectedTask.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="发布平台" span={2}>
                <Space wrap>
                  {selectedTask.platforms.map((p) => (
                    <Tag key={p} color={PLATFORM_COLORS[p]}>{PLATFORM_LABELS[p]}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              {selectedTask.description && (
                <Descriptions.Item label="简介" span={2}>{selectedTask.description}</Descriptions.Item>
              )}
              {selectedTask.tags?.length > 0 && (
                <Descriptions.Item label="标签" span={2}>
                  <Space wrap>{selectedTask.tags.map((t, i) => <Tag key={i}>{t}</Tag>)}</Space>
                </Descriptions.Item>
              )}
              {selectedTask.error_message && (
                <Descriptions.Item label="错误信息" span={2}>
                  <Text type="danger">{selectedTask.error_message}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedTask.publish_results?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>各平台发布结果</Title>
                {selectedTask.publish_results.map((result, i) => (
                  <Card key={i} size="small" style={{ marginBottom: 8 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Tag color={PLATFORM_COLORS[result.platform]}>{PLATFORM_LABELS[result.platform]}</Tag>
                        <Text>{result.platform_video_id || '-'}</Text>
                      </Space>
                      {result.status === 'success' ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
                      ) : (
                        <Tooltip title={result.error}>
                          <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
                        </Tooltip>
                      )}
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

