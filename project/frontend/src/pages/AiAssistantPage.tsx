import { useState, useEffect } from "react";
import {
  Card, Tabs, Form, Input, Select, Button, Typography, Space, List, Tag, Spin, Row, Col,
  Tooltip, message, Divider, Empty, Alert, Badge, Modal,
} from "antd";
import {
  RobotOutlined, FileTextOutlined, TagsOutlined, PictureOutlined, EditOutlined,
  CopyOutlined, ThunderboltOutlined, BulbOutlined, StarOutlined, SendOutlined,
  SettingOutlined, ReloadOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";
import { aiApi, settingsApi } from "@/services";
import { PLATFORM_LABELS } from "@/types";
import { useNavigate } from "react-router-dom";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function AiAssistantPage() {
  const [activeTab, setActiveTab] = useState("script");
  const [userModels, setUserModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [topicModalVisible, setTopicModalVisible] = useState(false);
  const [optimizingTopic, setOptimizingTopic] = useState(false);
  const [results, setResults] = useState<any>({});
  const navigate = useNavigate();

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const { data } = await settingsApi.get();
      const s = data.data;
      if (s.ai_available_models && s.ai_available_models.length > 0) {
        setUserModels(s.ai_available_models);
      }
      if (s.ai_model) {
        setCurrentModel(s.ai_model);
      }
      setAiConfigured(!!(s.ai_api_key && s.ai_api_key !== ""));
    } catch {
      setAiConfigured(false);
    }
  };

  const handleModelChange = (model: string) => {
    setCurrentModel(model);
    toast.success("已切换模型: " + model);
  };

  const getModelParam = (): string | undefined => {
    return currentModel || undefined;
  };

  // ===== AI 自动优化主题 =====
  const handleOptimizeTopic = async () => {
    const currentTopic = scriptForm.getFieldValue("topic");
    if (!currentTopic || !currentTopic.trim()) {
      toast.error("请先输入一个关键词或主题想法");
      return;
    }
    setOptimizingTopic(true);
    setTopicModalVisible(true);
    setTopicSuggestions([]);
    try {
      const platform = scriptForm.getFieldValue("platform");
      const model = getModelParam();
      const { data } = await aiApi.optimizeTopic({
        keywords: currentTopic.trim(),
        platform,
        model,
      });
      setTopicSuggestions(data.data.topics || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "主题优化失败");
      setTopicModalVisible(false);
    } finally {
      setOptimizingTopic(false);
    }
  };

  const handleSelectTopic = (topic: string) => {
    scriptForm.setFieldsValue({ topic });
    setTopicModalVisible(false);
    toast.success("已选择主题");
  };

  // ===== 视频脚本生成 =====
  const [scriptForm] = Form.useForm();
  const handleGenerateScript = async (values: any) => {
    setLoading(true);
    try {
      const model = getModelParam();
      const { data } = await aiApi.generateScript({ ...values, model });
      const raw = data.data.result || data.data;
      let result;
      try {
        result = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        result = { raw_text: typeof raw === "string" ? raw : JSON.stringify(raw) };
      }
      setResults((prev: any) => ({ ...prev, script: result }));
      toast.success("脚本生成成功");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // ===== 标题生成 =====
  const [titleForm] = Form.useForm();
  const handleGenerateTitles = async (values: any) => {
    setLoading(true);
    try {
      const model = getModelParam();
      const { data } = await aiApi.generateTitles({ ...values, model });
      setResults((prev: any) => ({ ...prev, titles: data.data.titles }));
      toast.success("标题生成成功");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // ===== 标签生成 =====
  const [tagForm] = Form.useForm();
  const handleGenerateTags = async (values: any) => {
    setLoading(true);
    try {
      const model = getModelParam();
      const { data } = await aiApi.generateTags({ ...values, model });
      setResults((prev: any) => ({ ...prev, tags: data.data.tags }));
      toast.success("标签生成成功");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // ===== 封面提示词生成 =====
  const [coverForm] = Form.useForm();
  const handleGenerateCoverPrompt = async (values: any) => {
    setLoading(true);
    try {
      const model = getModelParam();
      const { data } = await aiApi.generateCoverPrompt({ ...values, model });
      setResults((prev: any) => ({ ...prev, coverPrompt: data.data.prompt }));
      toast.success("封面提示词生成成功");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // ===== 视频描述生成 =====
  const [descForm] = Form.useForm();
  const handleGenerateDescription = async (values: any) => {
    setLoading(true);
    try {
      const model = getModelParam();
      const { data } = await aiApi.generateDescription({ ...values, model });
      setResults((prev: any) => ({ ...prev, description: data.data.description }));
      toast.success("描述生成成功");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败");
    });
  };

  const renderHelperTips = (tips: string[]) => (
    <Card size="small" style={{ marginBottom: 16, background: "#f6ffed", borderColor: "#b7eb8f" }}>
      <Space direction="vertical" size={4}>
        <Text strong style={{ color: "#52c41a" }}><BulbOutlined /> 使用技巧</Text>
        {tips.map((tip, i) => (
          <Text key={i} style={{ fontSize: 12, color: "#666" }}>• {tip}</Text>
        ))}
      </Space>
    </Card>
  );

  const modelSelector = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <Text strong style={{ fontSize: 13 }}>
        <RobotOutlined /> 当前模型:
      </Text>
      {userModels.length > 0 ? (
        <Select
          value={currentModel || undefined}
          onChange={handleModelChange}
          placeholder="选择 AI 模型"
          style={{ minWidth: 220 }}
          size="middle"
          options={userModels.map(m => ({ value: m, label: m }))}
          allowClear
          showSearch
        />
      ) : (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {currentModel || "未配置模型"}
        </Text>
      )}
      <Button
        type="link"
        size="small"
        icon={<SettingOutlined />}
        onClick={() => navigate("/settings")}
      >
        配置 API
      </Button>
      <Button
        type="link"
        size="small"
        icon={<ReloadOutlined />}
        onClick={loadUserSettings}
      >
        刷新
      </Button>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          🤖 AI 助手
        </Title>
        <Text type="secondary">利用 AI 帮你创作更吸引人的视频内容</Text>
      </div>

      {/* 模型选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        {modelSelector}
      </Card>

      {/* 未配置 API 提示 */}
      {!aiConfigured && (
        <Alert
          message="AI API 未配置"
          description={
            <span>
              当前使用本地模板生成内容。前往{" "}
              <a onClick={() => navigate("/settings")}>设置页面</a>{" "}
              配置 AI API Key 以获得真实 AI 生成。
            </span>
          }
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "script",
            label: <span><FileTextOutlined /> 视频脚本</span>,
            children: (
              <Row gutter={24}>
                <Col xs={24} lg={10}>
                  <Card title="📝 脚本参数">
                    {renderHelperTips([
                      "选择风格会影响脚本的语气和节奏",
                      "建议时长 30-60 秒的短视频效果最佳",
                      "可以指定目标平台以优化内容",
                    ])}
                    <Form form={scriptForm} layout="vertical" onFinish={handleGenerateScript}>
                      <Form.Item name="topic" label="视频主题" rules={[{ required: true, message: "请输入主题" }]}>
                        <TextArea rows={3} placeholder="例如：如何用手机拍出电影感的视频" />
                      </Form.Item>
                        <div style={{
                          marginBottom: 20,
                          background: "linear-gradient(135deg, #667eea11 0%, #764ba211 100%)",
                          borderRadius: 10,
                          border: "1px dashed #667eea",
                          padding: "14px 16px",
                          transition: "all 0.3s",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 16, flexShrink: 0,
                              }}>✨</div>
                              <div>
                                <Text strong style={{ fontSize: 13, color: "#667eea", display: "block", lineHeight: 1.2 }}>AI 智能优化主题</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>输入关键词，AI 自动生成 5 个优质主题</Text>
                              </div>
                            </div>
                            <Button
                              type="primary"
                              icon={<BulbOutlined />}
                              onClick={handleOptimizeTopic}
                              loading={optimizingTopic}
                              size="small"
                              style={{
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                border: "none",
                                borderRadius: 8,
                                fontWeight: 500,
                                boxShadow: "0 2px 8px #667eea44",
                              }}
                            >
                              {optimizingTopic ? "生成中..." : "生成建议"}
                            </Button>
                          </div>
                        </div>
                      <Form.Item name="style" label="脚本风格" initialValue="educational">
                        <Select size="large"
                          options={[
                            { value: "educational", label: "📚 知识科普 — 专业严谨，逻辑清晰" },
                            { value: "story", label: "📖 故事叙事 — 引人入胜，情感共鸣" },
                            { value: "fast-paced", label: "⚡ 快节奏 — 紧凑刺激，信息密集" },
                          ]} />
                      </Form.Item>
                      <Form.Item name="duration" label="视频时长(秒)">
                        <Select placeholder="选择时长" size="large"
                          options={[
                            { value: 15, label: "15 秒 — 超短视频" },
                            { value: 30, label: "30 秒 — 标准短视频" },
                            { value: 60, label: "60 秒 — 中等长度" },
                            { value: 120, label: "2 分钟 — 深度内容" },
                            { value: 300, label: "5 分钟 — 长视频" },
                          ]} />
                      </Form.Item>
                      <Form.Item name="platform" label="目标平台">
                        <Select allowClear placeholder="选择平台" size="large"
                          options={Object.entries(PLATFORM_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} icon={<ThunderboltOutlined />} size="large" block>
                          ✨ 生成脚本
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  <Card title="📄 生成结果" style={{ minHeight: 500 }}>
                    {loading ? (
                      <div style={{ textAlign: "center", padding: 80 }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16, color: "#999" }}>
                          {currentModel ? "正在使用 " + currentModel + " 生成..." : "正在使用模板生成..."}
                        </div>
                      </div>
                    ) : results.script ? (
                      <div>
                        {results.script.title && (
                          <Alert type="info" showIcon style={{ marginBottom: 16 }}
                            message={<span style={{ fontWeight: 600 }}>📋 {results.script.title}</span>} />
                        )}
                        {results.script.hook && (
                          <Card size="small" title="🪝 开场钩子" style={{ marginBottom: 12 }}
                            extra={<Button size="small" icon={<CopyOutlined />}
                              onClick={() => copyToClipboard(
                                typeof results.script.hook === 'string'
                                  ? results.script.hook
                                  : results.script.hook.content || JSON.stringify(results.script.hook)
                              )}>复制</Button>}>
                            <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                              {typeof results.script.hook === 'string'
                                ? results.script.hook
                                : results.script.hook.content || JSON.stringify(results.script.hook)}
                            </Paragraph>
                            {typeof results.script.hook === 'object' && results.script.hook.visuals && (
                              <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                                🎬 画面：{results.script.hook.visuals}
                              </Text>
                            )}
                          </Card>
                        )}
                        {Array.isArray(results.script.sections) && results.script.sections.map((section: any, i: number) => (
                          <Card key={i} size="small"
                            title={`📝 分镜 ${i + 1}${section.title ? ': ' + section.title : ''}`}
                            style={{ marginBottom: 12 }}
                            extra={
                              <Space>
                                {section.duration && <Tag color="blue">{section.duration}s</Tag>}
                                <Button size="small" icon={<CopyOutlined />}
                                  onClick={() => copyToClipboard(section.content || JSON.stringify(section))}>复制</Button>
                              </Space>
                            }>
                            <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>{section.content}</Paragraph>
                            {section.visuals && (
                              <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                                🎬 画面：{section.visuals}
                              </Text>
                            )}
                          </Card>
                        ))}
                        {results.script.cta && (
                          <Card size="small" title="📢 结尾引导" style={{ marginBottom: 12 }}
                            extra={<Button size="small" icon={<CopyOutlined />}
                              onClick={() => copyToClipboard(results.script.cta)}>复制</Button>}>
                            <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>{results.script.cta}</Paragraph>
                          </Card>
                        )}
                        {results.script.estimated_duration && (
                          <Tag color="blue" style={{ marginTop: 8 }}>⏱ 预估总时长: {results.script.estimated_duration}</Tag>
                        )}
                        {results.script.raw_text && (
                          <div style={{ background: "#f5f5f5", padding: 20, borderRadius: 8, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                            {results.script.raw_text}
                          </div>
                        )}
                        <div style={{ marginTop: 16, textAlign: "right" }}>
                          <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(
                            typeof results.script === "string" ? results.script : JSON.stringify(results.script, null, 2)
                          )}>复制完整 JSON</Button>
                        </div>
                      </div>
                    ) : (
                      <Empty description="填写参数后点击「生成脚本」" style={{ padding: 80 }} />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "titles",
            label: <span><StarOutlined /> 标题优化</span>,
            children: (
              <Row gutter={24}>
                <Col xs={24} lg={10}>
                  <Card title="✨ 标题参数">
                    {renderHelperTips([
                      "好标题 = 数字 + 悬念 + 情感词 + emoji",
                      "建议生成 5-8 个标题对比选择",
                      "加入平台关键词提升搜索曝光",
                    ])}
                    <Form form={titleForm} layout="vertical" onFinish={handleGenerateTitles}>
                      <Form.Item name="topic" label="视频主题" rules={[{ required: true, message: "请输入主题" }]}>
                        <TextArea rows={3} placeholder="描述你的视频内容和亮点" />
                      </Form.Item>
                      <Form.Item name="count" label="生成数量" initialValue={5}>
                        <Select size="large"
                          options={[3, 5, 8, 10].map(n => ({ value: n, label: n + " 个标题" }))} />
                      </Form.Item>
                      <Form.Item name="style" label="标题风格">
                        <Select allowClear placeholder="选择风格" size="large"
                          options={[
                            { value: "clickbait", label: "🔥 高点击率 — 吸引眼球" },
                            { value: "professional", label: "💼 专业正式 — 适合知识类" },
                            { value: "funny", label: "😄 幽默搞笑 — 轻松有趣" },
                            { value: "emotional", label: "❤️ 情感共鸣 — 引发共情" },
                          ]} />
                      </Form.Item>
                      <Form.Item name="platform" label="目标平台">
                        <Select allowClear placeholder="选择平台" size="large"
                          options={Object.entries(PLATFORM_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} icon={<ThunderboltOutlined />} size="large" block>
                          ✨ 生成标题
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  <Card title="📋 推荐标题" style={{ minHeight: 400 }}>
                    {loading ? (
                      <div style={{ textAlign: "center", padding: 80 }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16, color: "#999" }}>
                          {currentModel ? "正在使用 " + currentModel + " 生成..." : "正在使用模板生成..."}
                        </div>
                      </div>
                    ) : results.titles?.length > 0 ? (
                      <List
                        dataSource={results.titles}
                        renderItem={(title: string, index: number) => (
                          <List.Item
                            actions={[
                              <Tooltip title="复制标题" key="copy">
                                <Button type="text" icon={<CopyOutlined />} onClick={() => copyToClipboard(title)} />
                              </Tooltip>,
                            ]}
                          >
                            <List.Item.Meta
                              avatar={<div style={{
                                width: 32, height: 32, borderRadius: "50%",
                                background: index === 0 ? "#52c41a" : index < 3 ? "#1890ff" : "#999",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#fff", fontSize: 14, fontWeight: "bold",
                              }}>{index + 1}</div>}
                              title={<Text style={{ fontSize: 15 }}>{title}</Text>}
                            />
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Empty description="填写主题后点击「生成标题」" style={{ padding: 60 }} />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "tags",
            label: <span><TagsOutlined /> 标签推荐</span>,
            children: (
              <Row gutter={24}>
                <Col xs={24} lg={10}>
                  <Card title="🏷️ 标签参数">
                    {renderHelperTips([
                      "热门标签能带来搜索流量",
                      "混合使用大标签和长尾标签",
                      "建议 10-15 个标签效果最佳",
                    ])}
                    <Form form={tagForm} layout="vertical" onFinish={handleGenerateTags}>
                      <Form.Item name="title" label="视频标题" rules={[{ required: true, message: "请输入标题" }]}>
                        <TextArea rows={2} placeholder="输入你的视频标题" />
                      </Form.Item>
                      <Form.Item name="description" label="视频简介（可选）">
                        <TextArea rows={2} placeholder="输入视频简介，帮助 AI 更精准推荐标签" />
                      </Form.Item>
                      <Form.Item name="platform" label="目标平台">
                        <Select allowClear placeholder="选择平台" size="large"
                          options={Object.entries(PLATFORM_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} icon={<ThunderboltOutlined />} size="large" block>
                          ✨ 生成标签
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  <Card
                    title="🏷️ 推荐标签"
                    extra={results.tags?.length > 0 && (
                      <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(results.tags.join(" "))}>
                        复制全部
                      </Button>
                    )}
                    style={{ minHeight: 400 }}
                  >
                    {loading ? (
                      <div style={{ textAlign: "center", padding: 80 }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16, color: "#999" }}>
                          {currentModel ? "正在使用 " + currentModel + " 生成..." : "正在使用模板生成..."}
                        </div>
                      </div>
                    ) : results.tags?.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {results.tags.map((tag: string, i: number) => (
                          <Tag
                            key={i}
                            color="blue"
                            style={{ cursor: "pointer", fontSize: 14, padding: "4px 12px" }}
                            onClick={() => copyToClipboard(tag)}
                          >
                            {tag}
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <Empty description="输入标题后点击「生成标签」" style={{ padding: 60 }} />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "description",
            label: <span><EditOutlined /> 视频描述</span>,
            children: (
              <Row gutter={24}>
                <Col xs={24} lg={10}>
                  <Card title="📄 描述参数">
                    {renderHelperTips([
                      "好的描述包含 emoji + 关键词 + 标签",
                      "长度控制在 150-300 字最佳",
                      "开头第一句最重要，决定是否展开阅读",
                    ])}
                    <Form form={descForm} layout="vertical" onFinish={handleGenerateDescription}>
                      <Form.Item name="topic" label="视频主题" rules={[{ required: true, message: "请输入主题" }]}>
                        <TextArea rows={3} placeholder="描述你的视频内容" />
                      </Form.Item>
                      <Form.Item name="platform" label="目标平台">
                        <Select allowClear placeholder="选择平台" size="large"
                          options={Object.entries(PLATFORM_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} icon={<ThunderboltOutlined />} size="large" block>
                          ✨ 生成描述
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  <Card
                    title="📄 视频描述"
                    extra={results.description && (
                      <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(results.description)}>
                        复制描述
                      </Button>
                    )}
                    style={{ minHeight: 400 }}
                  >
                    {loading ? (
                      <div style={{ textAlign: "center", padding: 80 }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16, color: "#999" }}>
                          {currentModel ? "正在使用 " + currentModel + " 生成..." : "正在使用模板生成..."}
                        </div>
                      </div>
                    ) : results.description ? (
                      <Paragraph style={{
                        whiteSpace: "pre-wrap", background: "#fafafa", padding: 20,
                        borderRadius: 8, fontSize: 14, lineHeight: 1.8,
                      }}>
                        {results.description}
                      </Paragraph>
                    ) : (
                      <Empty description="输入主题后点击「生成描述」" style={{ padding: 60 }} />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "cover",
            label: <span><PictureOutlined /> 封面提示词</span>,
            children: (
              <Row gutter={24}>
                <Col xs={24} lg={10}>
                  <Card title="🎨 输入参数">
                    {renderHelperTips([
                      "生成的提示词适用于 Midjourney / DALL-E / Stable Diffusion",
                      "复制提示词后到 AI 绘图工具中使用",
                      "选择风格会影响画面效果",
                    ])}
                    <Form form={coverForm} layout="vertical" onFinish={handleGenerateCoverPrompt}>
                      <Form.Item name="topic" label="视频主题" rules={[{ required: true, message: "请输入主题" }]}>
                        <TextArea rows={3} placeholder="描述你想要的封面画面" />
                      </Form.Item>
                      <Form.Item name="style" label="画面风格">
                        <Select allowClear placeholder="选择风格" size="large"
                          options={[
                            { value: "cinematic", label: "🎬 电影感 — 大片质感，光影丰富" },
                            { value: "cartoon", label: "🎨 卡通风 — 活泼可爱，色彩鲜艳" },
                            { value: "realistic", label: "📷 写实风 — 照片级真实感" },
                            { value: "minimalist", label: "✨ 极简风 — 简洁大方，留白多" },
                            { value: "vibrant", label: "🌈 鲜艳色彩 — 高饱和度，视觉冲击" },
                            { value: "3d", label: "🧊 3D 渲染 — 立体感强，现代风格" },
                          ]} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} icon={<PictureOutlined />} size="large" block>
                          ✨ 生成提示词
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  <Card
                    title="🎨 封面提示词"
                    extra={results.coverPrompt && (
                      <Space>
                        <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(results.coverPrompt)}>
                          复制提示词
                        </Button>
                      </Space>
                    )}
                    style={{ minHeight: 400 }}
                  >
                    {loading ? (
                      <div style={{ textAlign: "center", padding: 80 }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16, color: "#999" }}>
                          {currentModel ? "正在使用 " + currentModel + " 生成..." : "正在使用模板生成..."}
                        </div>
                      </div>
                    ) : results.coverPrompt ? (
                      <div>
                        <div style={{
                          background: "#1a1a2e", color: "#e0e0e0", padding: 20,
                          borderRadius: 8, fontFamily: "monospace", fontSize: 14,
                          lineHeight: 1.8, whiteSpace: "pre-wrap",
                        }}>
                          {results.coverPrompt}
                        </div>
                        <div style={{ marginTop: 16, color: "#999", fontSize: 12 }}>
                          💡 将以上提示词粘贴到 Midjourney、DALL-E 或 Stable Diffusion 中即可生成封面图
                        </div>
                      </div>
                    ) : (
                      <Empty description="输入主题后点击「生成提示词」" style={{ padding: 60 }} />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
<Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#fff',
            }}>
              <ThunderboltOutlined />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>AI 智能主题推荐</div>
              <div style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>点击主题即可一键填入</div>
            </div>
          </div>
        }
        open={topicModalVisible}
        onCancel={() => setTopicModalVisible(false)}
        footer={null}
        width={560}
        styles={{ header: { borderBottom: '1px solid #f0f0f0', paddingBottom: 12 } }}
      >
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: '#f6f8fc', fontSize: 13, color: '#666', lineHeight: 1.6,
        }}>
          基于关键词「<Text strong style={{ color: '#667eea' }}>{scriptForm.getFieldValue("topic") || ""}</Text>」，AI 为你生成了以下主题建议：
        </div>
        {optimizingTopic ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#999', fontSize: 13 }}>AI 正在构思优质主题...</div>
          </div>
        ) : topicSuggestions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topicSuggestions.map((topic, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectTopic(topic)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: '#fff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.background = '#f8f9ff';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#f0f0f0';
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, #667eea22 0%, #764ba222 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, color: '#667eea', flexShrink: 0,
                }}>
                  {idx + 1}
                </div>
                <span style={{ fontSize: 14, flex: 1, lineHeight: 1.5 }}>{topic}</span>
                <div style={{
                  fontSize: 11, color: '#667eea', whiteSpace: 'nowrap',
                  opacity: 0.7,
                }}>
                  点击选择 →
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="暂无建议" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Modal>
    </div>
  );
}
