import { useState, useEffect, useCallback } from 'react';
import {
  Card, Calendar, Badge, Modal, Form, Input, DatePicker, Select, Typography, Button,
  Tag, Space, List, Tooltip, Popconfirm, Divider, TimePicker,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { calendarApi } from '@/services';
import { ContentCalendar } from '@/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLORS: Record<string, string> = {
  planned: 'blue',
  scheduled: 'orange',
  published: 'green',
  cancelled: 'gray',
};

const STATUS_LABELS: Record<string, string> = {
  planned: '计划中',
  scheduled: '已排期',
  published: '已发布',
  cancelled: '已取消',
};

export default function CalendarPage() {
  const [events, setEvents] = useState<ContentCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ContentCalendar | null>(null);
  const [form] = Form.useForm();
  const [rescheduleForm] = Form.useForm();

  const currentMonthRef = { start: dayjs().startOf('month'), end: dayjs().endOf('month') };

  useEffect(() => {
    loadEvents(currentMonthRef.start.format('YYYY-MM-DD'), currentMonthRef.end.format('YYYY-MM-DD'));
  }, []);

  const loadEvents = async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      const { data } = await calendarApi.getEvents(startDate, endDate);
      setEvents(data.data);
    } catch {
      toast.error('加载日历失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePanelChange = (date: Dayjs) => {
    currentMonthRef.start = date.startOf('month');
    currentMonthRef.end = date.endOf('month');
    loadEvents(date.startOf('month').format('YYYY-MM-DD'), date.endOf('month').format('YYYY-MM-DD'));
  };

  const handleDateSelect = (date: Dayjs) => {
    setSelectedDate(date);
    form.setFieldsValue({ date });
    setModalOpen(true);
  };

  const handleEventClick = (event: ContentCalendar, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  const handleCreate = async (values: any) => {
    try {
      await calendarApi.createEvent({
        title: values.title,
        description: values.description,
        date: values.date.format('YYYY-MM-DD'),
        time: values.time ? values.time.format('HH:mm') : undefined,
        color: values.color || '#3B82F6',
      });
      toast.success('事件已创建');
      setModalOpen(false);
      form.resetFields();
      loadEvents(currentMonthRef.start.format('YYYY-MM-DD'), currentMonthRef.end.format('YYYY-MM-DD'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleDeleteEvent = async (id: number) => {
    try {
      await calendarApi.deleteEvent(id);
      toast.success('已删除');
      setDetailModalOpen(false);
      setSelectedEvent(null);
      loadEvents(currentMonthRef.start.format('YYYY-MM-DD'), currentMonthRef.end.format('YYYY-MM-DD'));
    } catch {
      toast.error('删除失败');
    }
  };

  const handleReschedule = async (values: any) => {
    if (!selectedEvent) return;
    try {
      await calendarApi.updateEvent(selectedEvent.id, {
        date: values.new_date.format('YYYY-MM-DD'),
      });
      toast.success('日期已更新');
      setRescheduleModalOpen(false);
      setDetailModalOpen(false);
      setSelectedEvent(null);
      loadEvents(currentMonthRef.start.format('YYYY-MM-DD'), currentMonthRef.end.format('YYYY-MM-DD'));
    } catch {
      toast.error('更新失败');
    }
  };

  const weekStart = dayjs().startOf('week');
  const weekEnd = dayjs().endOf('week');
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  const weekEvents = events.filter((e) => {
    const d = dayjs(e.date);
    return d.isAfter(weekStart.subtract(1, 'day')) && d.isBefore(weekEnd.add(1, 'day'));
  });

  const dateCellRender = (date: Dayjs) => {
    const dayEvents = events.filter((e) => dayjs(e.date).format('YYYY-MM-DD') === date.format('YYYY-MM-DD'));
    return (
      <div
        style={{ minHeight: 60 }}
        onClick={() => handleDateSelect(date)}
      >
        {dayEvents.map((evt) => (
          <Tooltip key={evt.id} title={evt.title}>
            <div
              onClick={(e) => handleEventClick(evt, e)}
              style={{
                background: evt.color || '#3B82F6',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 4,
                marginBottom: 2,
                fontSize: 11,
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {evt.title}
            </div>
          </Tooltip>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>📅 内容日历</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          新建计划
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* 日历主体 */}
        <Card style={{ flex: 3 }}>
          <Calendar
            cellRender={(date, info) => {
              if (info.type === 'date') return dateCellRender(date);
              return info.originNode;
            }}
            onPanelChange={handlePanelChange}
          />
        </Card>

        {/* 本周计划侧栏 */}
        <Card title="📋 本周计划" style={{ flex: 1, minWidth: 260 }}>
          {weekDays.map((day) => {
            const dayEvts = weekEvents.filter((e) => dayjs(e.date).format('YYYY-MM-DD') === day.format('YYYY-MM-DD'));
            return (
              <div key={day.format('YYYY-MM-DD')} style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 12, color: day.isSame(dayjs(), 'day') ? '#3B82F6' : '#666' }}>
                  {day.format('MM/DD ddd')}
                  {day.isSame(dayjs(), 'day') && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>今天</Tag>}
                </Text>
                {dayEvts.length > 0 ? (
                  dayEvts.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={(e) => handleEventClick(evt, e)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                        marginTop: 4, borderRadius: 4, cursor: 'pointer',
                        background: '#fafafa', border: `1px solid ${evt.color || '#3B82F6'}`,
                      }}
                    >
                      <div style={{ width: 4, height: 24, borderRadius: 2, background: evt.color || '#3B82F6' }} />
                      <div>
                        <Text style={{ maxWidth: 200, fontSize: 13 }}>{evt.title}</Text>
                        {evt.time && (
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                            <ClockCircleOutlined /> {evt.time}
                          </Text>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>暂无安排</Text>
                )}
              </div>
            );
          })}
        </Card>
      </div>

      {/* 新建弹窗 */}
      <Modal
        title="新建内容计划"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：发布美食视频" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="视频内容大纲或备注" />
          </Form.Item>
          <Form.Item label="日期" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="时间" name="time">
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="颜色" name="color" initialValue="#3B82F6">
            <Select
              options={[
                { value: '#3B82F6', label: <><Tag color="#3B82F6">蓝色</Tag> 计划中</> },
                { value: '#F59E0B', label: <><Tag color="#F59E0B">橙色</Tag> 已排期</> },
                { value: '#10B981', label: <><Tag color="#10B981">绿色</Tag> 已发布</> },
                { value: '#EF4444', label: <><Tag color="#EF4444">红色</Tag> 重要</> },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 事件详情弹窗 */}
      <Modal
        title={<Space><CalendarOutlined /> 事件详情</Space>}
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setSelectedEvent(null); }}
        footer={
          selectedEvent ? (
            <Space>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  rescheduleForm.setFieldsValue({ new_date: dayjs(selectedEvent.date) });
                  setRescheduleModalOpen(true);
                }}
              >
                修改日期
              </Button>
              <Popconfirm title="确定删除此事件？" onConfirm={() => handleDeleteEvent(selectedEvent.id)}>
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
              <Button type="primary" onClick={() => { setDetailModalOpen(false); setSelectedEvent(null); }}>
                关闭
              </Button>
            </Space>
          ) : null
        }
        destroyOnClose
      >
        {selectedEvent && (
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>{selectedEvent.title}</Title>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {selectedEvent.description && <Text>{selectedEvent.description}</Text>}
              <Space><CalendarOutlined /><Text>日期：{selectedEvent.date}</Text></Space>
              {selectedEvent.time && <Space><ClockCircleOutlined /><Text>时间：{selectedEvent.time}</Text></Space>}
              <Space>
                <Text>状态：</Text>
                <Tag color={STATUS_COLORS[selectedEvent.status]}>{STATUS_LABELS[selectedEvent.status] || selectedEvent.status}</Tag>
              </Space>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text>颜色：</Text>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: selectedEvent.color || '#3B82F6' }} />
              </div>
            </Space>
          </div>
        )}
      </Modal>

      {/* 修改日期弹窗 */}
      <Modal
        title="修改事件日期"
        open={rescheduleModalOpen}
        onCancel={() => setRescheduleModalOpen(false)}
        onOk={() => rescheduleForm.submit()}
        destroyOnClose
      >
        <Form form={rescheduleForm} layout="vertical" onFinish={handleReschedule}>
          <Form.Item label="选择新日期" name="new_date" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
