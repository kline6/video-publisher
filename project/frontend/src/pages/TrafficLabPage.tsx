import { useState, useEffect } from 'react';
import {
  Card, Row, Col, Tabs, List, Tag, Button, Typography, Spin, Space, Statistic, Empty,
  Progress, Tooltip, Badge, Divider,
} from 'antd';
import {
  FireOutlined, ClockCircleOutlined, ReloadOutlined, ThunderboltOutlined,
  RocketOutlined, BulbOutlined, RiseOutlined, AimOutlined, CrownOutlined,
  ExperimentOutlined, TagsOutlined,
} from '@ant-design/icons';
import toast from 'react-hot-toast';
import { trafficApi, aiApi } from '@/services';
import { HotTopic, PLATFORM_LABELS, PLATFORM_COLORS, Platform } from '@/types';

const { Title, Text, Paragraph } = Typography;

export default function TrafficLabPage() {
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
  const [bestTimes, setBestTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('hot-topics');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsRes, timesRes] = await Promise.all([
        trafficApi.getHotTopics({ limit: 30 }),
        trafficApi.getBestTime(),
      ]);
      setHotTopics(topicsRes.data.data);
      setBestTimes(timesRes.data.data);
    } catch {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshTopics = async () => {
    setRefreshing(true);
    try {
      await trafficApi.refreshHotTopics();
      const { data } = await trafficApi.getHotTopics({ limit: 30 });
      setHotTopics(data.data);
      toast.success('热门话题已刷新');
    } catch {
      toast.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const getDayName = (day: number) => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[day] || '';
  };

  const getHeatLevel = (heat: number) => {
    if (heat >= 1000000) return { color: '#ff4d4f', text: '🔥 爆', level: 100 };
    if (heat >= 500000) return { color: '#ff7a45', text: '🔥 热', level: 80 };
    if (heat >= 100000) return { color: '#ffa940', text: '📈 高', level: 60 };
    if (heat >= 50000) return { color: '#ffc53d', text: '📊 中', level: 40 };
    return { color: '#d9d9d9', text: '📉 低', level: 20 };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="正在加载流量数据..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>🚀 流量实验室</Title>
        <Text type="secondary">追踪热门话题、分析最佳发布时间、获取流量增长策略</Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="large"
        items={[
          {
            key: 'hot-topics',
            label: <span><FireOutlined /> 热门话题</span>,
            children: (
              <div>
                <Card style={{ marginBottom: 16 }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Space>
                        <Text strong style={{ fontSize: 16 }}>🔥 实时热门话题追踪</Text>
                        <Badge count={hotTopics.length} style={{ backgroundColor: '#3B82F6' }} />
                      </Space>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        覆盖抖音、B站、快手等主流平台，每 30 分钟自动更新
                      </Text>
                    </Col>
                    <Col>
                      <Button
                        type="primary"
                        icon={<ReloadOutlined spin={refreshing} />}
                        onClick={handleRefreshTopics}
                        loading={refreshing}
                      >
                        刷新话题
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {hotTopics.length === 0 ? (
                  <Card>
                    <Empty
                      description={
                        <div>
                          <Text>暂无热门话题数据</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>点击上方"刷新话题"按钮获取最新热点</Text>
                        </div>
                      }
                    />
                  </Card>
                ) : (
                  <List
                    grid={{ gutter: 16, xs: 1, sm: 2, md: 3 }}
                    dataSource={hotTopics}
                    renderItem={(topic, index) => {
                      const heat = getHeatLevel(topic.heat_value);
                      return (
                        <List.Item>
                          <Card
                            size="small"
                            hoverable
                            style={{ borderLeft: `3px solid ${heat.color}` }}
                          >
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              <Space>
                                <Tag color="red" style={{ fontWeight: 'bold' }}>#{index + 1}</Tag>
                                <Tag color={PLATFORM_COLORS[topic.platform as Platform]}>
                                  {PLATFORM_LABELS[topic.platform as Platform] || topic.platform}
                                </Tag>
                                {topic.category && <Tag>{topic.category}</Tag>}
                              </Space>
                              <Text strong style={{ fontSize: 15, lineHeight: 1.4 }}>{topic.title}</Text>
                              <div>
                                <Progress
                                  percent={heat.level}
                                  showInfo={false}
                                  strokeColor={heat.color}
                                  size="small"
                                />
                                <Space style={{ marginTop: 4 }}>
                                  <Text style={{ fontSize: 12, color: heat.color }}>{heat.text}</Text>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    热度 {(topic.heat_value / 10000).toFixed(1)}万
                                  </Text>
                                </Space>
                              </div>
                            </Space>
                          </Card>
                        </List.Item>
                      );
                    }}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'best-time',
            label: <span><ClockCircleOutlined /> 最佳发布时间</span>,
            children: (
              <div>
                <Card style={{ marginBottom: 16 }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text strong style={{ fontSize: 16 }}>⏰ 智能发布时间推荐</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        基于行业大数据和你的历史表现，精准推荐发布时段
                      </Text>
                    </Col>
                  </Row>
                </Card>

                {bestTimes.length === 0 ? (
                  <Card><Empty description="暂无推荐数据" /></Card>
                ) : (
                  <Row gutter={[16, 16]}>
                    {bestTimes.map((time, index) => (
                      <Col xs={24} sm={12} md={8} key={index}>
                        <Card
                          size="small"
                          hoverable
                          style={{
                            background: index < 3 ? 'linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))' : undefined,
                          }}
                        >
                          <Space align="start">
                            <div style={{
                              width: 48, height: 48, borderRadius: '50%',
                              background: index < 3 ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f0f0f0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: index < 3 ? '#fff' : '#666', fontWeight: 'bold', fontSize: 16,
                              flexShrink: 0,
                            }}>
                              {index < 3 ? <CrownOutlined /> : `#${index + 1}`}
                            </div>
                            <div>
                              <Text strong style={{ fontSize: 15 }}>
                                {time.label || `${getDayName(time.day_of_week)} ${String(time.hour).padStart(2, '0')}:00`}
                              </Text>
                              {index < 3 && <Tag color="gold" style={{ marginLeft: 8 }}>黄金时段</Tag>}
                              {time.sample_count > 0 && (
                                <div style={{ marginTop: 4 }}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    基于 {time.sample_count} 条样本 · 平均播放 {(time.avg_views || 0).toLocaleString()}
                                  </Text>
                                </div>
                              )}
                            </div>
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            ),
          },
          {
            key: 'tips',
            label: <span><RocketOutlined /> 流量攻略</span>,
            children: (
              <Row gutter={[16, 16]}>
                {[
                  {
                    icon: <ThunderboltOutlined style={{ color: '#f5222d', fontSize: 24 }} />,
                    title: '标题写法技巧',
                    color: '#fff1f0',
                    border: '#ffa39e',
                    tips: [
                      { text: '使用数字（"3个秘诀"、"99%的人不知道"）', hot: true },
                      { text: '制造悬念（"结果让我震惊"、"最后一种绝了"）', hot: true },
                      { text: '引发好奇（"为什么...？"、"居然..."）', hot: false },
                      { text: '使用 emoji 增加视觉吸引力 🔥', hot: false },
                      { text: '控制在 15-30 字以内', hot: false },
                    ],
                  },
                  {
                    icon: <TagsOutlined style={{ color: '#1890ff', fontSize: 24 }} />,
                    title: '标签策略',
                    color: '#e6f7ff',
                    border: '#91d5ff',
                    tips: [
                      { text: '3-5 个核心关键词', hot: false },
                      { text: '2-3 个热门话题标签', hot: true },
                      { text: '避免过热标签（竞争太大，容易被淹没）', hot: true },
                      { text: '添加 1-2 个平台专属标签', hot: false },
                      { text: '标签总数控制在 10-15 个', hot: false },
                    ],
                  },
                  {
                    icon: <ClockCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />,
                    title: '发布时间建议',
                    color: '#f6ffed',
                    border: '#b7eb8f',
                    tips: [
                      { text: '抖音：12:00-13:00、18:00-20:00', hot: true },
                      { text: 'B站：17:00-19:00（下班/放学时段）', hot: false },
                      { text: 'YouTube：工作日上午 9-11 点', hot: false },
                      { text: '避开大号发布高峰期', hot: true },
                      { text: '保持固定更新频率，培养用户期待', hot: true },
                    ],
                  },
                  {
                    icon: <RiseOutlined style={{ color: '#722ed1', fontSize: 24 }} />,
                    title: '涨粉秘籍',
                    color: '#f9f0ff',
                    border: '#d3adf7',
                    tips: [
                      { text: '前 3 秒决定生死 — 钩子必须够强', hot: true },
                      { text: '保持垂直领域深耕，不要杂乱', hot: true },
                      { text: '积极回复评论，增加互动率', hot: false },
                      { text: '定期发布，让算法记住你', hot: false },
                      { text: '研究对标账号的爆款视频规律', hot: true },
                    ],
                  },
                ].map((section) => (
                  <Col xs={24} sm={12} key={section.title}>
                    <Card style={{ background: section.color, borderColor: section.border }}>
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space>
                          {section.icon}
                          <Title level={5} style={{ margin: 0 }}>{section.title}</Title>
                        </Space>
                        <div>
                          {section.tips.map((tip, i) => (
                            <div key={i} style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ color: '#999' }}>•</span>
                              <Text style={{ flex: 1 }}>{tip.text}</Text>
                              {tip.hot && <Tag color="red" style={{ fontSize: 10 }}>关键</Tag>}
                            </div>
                          ))}
                        </div>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
}


