import { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, Tag, Space, List, Avatar, Progress, Tooltip, Button, Empty } from 'antd';
import {
  VideoCameraOutlined, EyeOutlined, LikeOutlined, RiseOutlined,
  ClockCircleOutlined, PlayCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import toast from 'react-hot-toast';
import { trafficApi } from '@/services';
import { DashboardStats, PLATFORM_LABELS, PLATFORM_COLORS, Platform } from '@/types';

const { Title, Text } = Typography;

function useAnimatedNumber(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.floor(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  const animated = useAnimatedNumber(value);
  return (
    <Card hoverable style={{ borderTop: '3px solid ' + color }}>
      <Statistic title={title} value={animated} prefix={icon} />
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await trafficApi.getDashboard();
      setStats(res.data?.data);
    } catch {
      toast.error('加载看板失败');
    } finally { setLoading(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!stats) return null;

  const platforms = Object.keys(stats.platform_breakdown || {}) as Platform[];
  const totalViews = platforms.reduce((s, p) => s + (stats.platform_breakdown[p]?.views || 0), 0);
  const hasRealData = stats.total_videos > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>📊 数据看板</Title>
        <Button icon={<ReloadOutlined />} onClick={loadDashboard}>刷新</Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="发布视频数" value={stats.total_videos} color="#3B82F6" icon={<VideoCameraOutlined style={{ color: '#3B82F6' }} />} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="总播放量" value={stats.total_views} color="#10B981" icon={<EyeOutlined style={{ color: '#10B981' }} />} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="总点赞数" value={stats.total_likes} color="#F59E0B" icon={<LikeOutlined style={{ color: '#F59E0B' }} />} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="总粉丝数" value={stats.total_followers} color="#EF4444" icon={<RiseOutlined style={{ color: '#EF4444' }} />} />
        </Col>
      </Row>

      {!hasRealData && (
        <Card style={{ marginTop: 24, textAlign: 'center' }}>
          <Empty
            description={
              <div>
                <Text style={{ fontSize: 16 }}>暂无发布数据</Text>
                <br />
                <Text type="secondary">绑定账号并发布视频后，数据将自动统计到这里</Text>
              </div>
            }
          >
            <Space>
              <Button type="primary" href="/accounts">绑定账号</Button>
              <Button href="/publish">去发布</Button>
            </Space>
          </Empty>
        </Card>
      )}

      {hasRealData && platforms.length > 0 && (
        <Card title="📱 平台分布" style={{ marginTop: 24 }}>
          <Row gutter={[16, 16]}>
            {platforms.map((platform) => {
              const bd = stats.platform_breakdown[platform];
              const pct = totalViews > 0 ? Math.round(((bd?.views || 0) / totalViews) * 100) : 0;
              return (
                <Col xs={24} sm={12} md={8} key={platform}>
                  <Card size="small" hoverable>
                    <Space direction="vertical" style={{ width: '100%' }} size={4}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tag color={PLATFORM_COLORS[platform]} style={{ borderRadius: 4 }}>{PLATFORM_LABELS[platform]}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>{pct}%</Text>
                      </div>
                      <Progress percent={pct} showInfo={false} strokeColor={PLATFORM_COLORS[platform]} size="small" />
                      <Row gutter={8}>
                        <Col span={8}><Statistic title="视频" value={bd?.videos || 0} valueStyle={{ fontSize: 16 }} /></Col>
                        <Col span={8}><Statistic title="播放" value={bd?.views || 0} valueStyle={{ fontSize: 16 }} /></Col>
                        <Col span={8}><Statistic title="点赞" value={bd?.likes || 0} valueStyle={{ fontSize: 16 }} /></Col>
                      </Row>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {stats.trend_data && stats.trend_data.length > 0 && (
        <Card title="📈 趋势" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 180, gap: 3, overflowX: 'auto' }}>
            {stats.trend_data.map((d, i) => {
              const maxV = Math.max(...stats.trend_data.map(t => t.views), 1);
              return (
                <Tooltip key={i} title={d.date + ' 播放:' + d.views}>
                  <div style={{ flex: 1, minWidth: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div style={{ width: '100%', maxWidth: 18, height: ((d.views / maxV) * 100) + '%', borderRadius: '3px 3px 0 0', background: 'linear-gradient(180deg, #3B82F6, #60A5FA)' }} />
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
