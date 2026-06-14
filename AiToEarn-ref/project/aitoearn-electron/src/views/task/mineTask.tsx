/*
 * @Author: nevin
 * @Date: 2025-02-27 19:37:08
 * @LastEditTime: 2025-03-24 14:11:03
 * @LastEditors: nevin
 * @Description: 我的任务列表
 */
import {
  Button,
  Card,
  Spin,
  Modal,
  Select,
  Space,
  Tag,
  Empty,
  message,
} from 'antd';
import { useState, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { taskApi } from '@/api/task';
import { UserTask, UserTaskStatus } from '@/api/types/task';
import { Task, TaskDataInfo } from '@@/types/task';
import MineTaskInfo, { MineTaskInfoRef } from './components/mineInfo';
import { WithdrawRef } from './components/withdraw';
import Withdraw from './components/withdraw';
import styles from './mineTask.module.scss';
import {
  ReloadOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  RightOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
const FILE_BASE_URL = import.meta.env.VITE_APP_FILE_HOST;

import bindTaskImg from '@/assets/task/binds.png';
import checkTaskImg from '@/assets/task/waits.png';
import publishTaskImg from '@/assets/task/fabu.png';
import rewardTaskImg from '@/assets/task/jiesuan.png';
import qr2 from '@/assets/task/qr0.jpg';
import logo from '@/assets/logo.png';

const UserTaskStatusNameMap = new Map<UserTaskStatus, string>([
  [UserTaskStatus.DODING, '进行�?],
  [UserTaskStatus.PENDING, '待审�?],
  [UserTaskStatus.APPROVED, '已通过'],
  [UserTaskStatus.REJECTED, '已拒�?],
  // [UserTaskStatus.COMPLETED, '已完�?],
  [UserTaskStatus.CANCELLED, '已取�?],
  // [UserTaskStatus.PENDING_REWARD, '待发放奖�?],
  [UserTaskStatus.REWARDED, '已发放奖�?],
]);

// 状态对应的颜色
const UserTaskStatusColorMap = new Map<UserTaskStatus, string>([
  [UserTaskStatus.DODING, 'processing'],
  [UserTaskStatus.PENDING, 'warning'],
  [UserTaskStatus.APPROVED, 'success'],
  [UserTaskStatus.REJECTED, 'error'],
  [UserTaskStatus.CANCELLED, 'default'],
  [UserTaskStatus.REWARDED, 'success'],
]);

// 在文件顶部添加任务类型映�?
const TASK_TYPE_MAP = {
  video: { name: '视频任务', color: '#a66ae4' },
  promotion: { name: '推广任务', color: '#1890ff' },
  product: { name: '挂车市场任务', color: '#52c41a' },
  article: { name: '文章任务', color: '#0958d9' },
};

// 渲染空状�?
const renderEmptyState = () => {
  return (
    <div className={styles.emptyContainer}>
      <div className={styles.emptyText}>
        <h3>接单前请务必先浏览《接单指南与常见问题解答�?/h3>
        <p>所有关于接单的秘诀都在这里，请不要错过</p>
      </div>

      <div className={styles.guideContainer}>
        <div className={styles.guideStep}>
          <h4>接单前完成以下步骤，接单快人一�?/h4>

          <div className={styles.qrCodeContainer}>
            

            <div className={styles.qrCodeItem}>
              <div className={styles.qrCodeWrapper}>
                <img
                  src={qr2}
                  alt="扫码开启更多权�?
                  className={styles.qrCode}
                />
              </div>
              <p className={styles.qrCodeText}>扫码开启更多权�?/p>
              <p className={styles.qrCodeSubtext}>手机扫码哎哟赚公众号</p>
            </div>
          </div>
        </div>

        <div className={styles.processContainer}>
          <h4 className={styles.processTitle}>接单流程</h4>

          <div className={styles.processSteps}>
            <div className={styles.processStep}>
              <div className={styles.processIcon}>
                <img
                  src={bindTaskImg}
                  alt="前往管理中心绑定账号"
                  className={styles.stepIcon}
                />
              </div>
              <p className={styles.stepText}>前往管理中心绑定账号</p>
            </div>

            <div className={styles.processDivider}></div>

            <div className={styles.processStep}>
              <div className={styles.processIcon}>
                <img
                  src={checkTaskImg}
                  alt="等待平台验证通过"
                  className={styles.stepIcon}
                />
              </div>
              <p className={styles.stepText}>等待平台验证通过</p>
            </div>

            <div className={styles.processDivider}></div>

            <div className={styles.processStep}>
              <div className={styles.processIcon}>
                <img
                  src={publishTaskImg}
                  alt="一键发�?
                  className={styles.stepIcon}
                />
              </div>
              <p className={styles.stepText}>一键发�?/p>
            </div>

            <div className={styles.processDivider}></div>

            <div className={styles.processStep}>
              <div className={styles.processIcon}>
                <img
                  src={rewardTaskImg}
                  alt="成功发文等待结算"
                  className={styles.stepIcon}
                />
              </div>
              <p className={styles.stepText}>成功发文等待结算</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Page() {
  const [taskList, setTaskList] = useState<any>([]);
  const [pageInfo, setPageInfo] = useState({
    pageSize: 20,
    page: 1,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isGuideModalVisible, setIsGuideModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<UserTaskStatus | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // 使用 react-intersection-observer 创建一个观察器
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
    rootMargin: '100px 0px',
  });

  // 当底部元素进入视图时加载更多数据
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading]);

  const fetchTaskDetails = async (isLoadMore = false, pageInfoParam: any) => {
    setLoading(true);
    try {
      const params = {
        ...(pageInfoParam || pageInfo),
        status: statusFilter,
      };

      // 如果没有选择状态筛选，则不传status参数
      if (statusFilter === null) {
        delete (params as any).status;
      }

      const tasks = await taskApi.getMineTaskList(params as any);

      if (isLoadMore) {
        setTaskList((prev:any) => [...prev, ...tasks.items]);
      } else {
        setTaskList(tasks.items);
      }

      setPageInfo((prev) => ({
        ...prev,
        totalCount: (tasks as any).meta.totalItems,
      }));

      // 检查是否还有更多数�?
      setHasMore(
        pageInfo.page * pageInfo.pageSize < (tasks as any).meta.totalItems,
      );
    } catch (error) {
      console.error('获取任务列表失败', error);
      message.error('获取任务列表失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMore()
  }, [statusFilter]);

  // 加载更多数据
  const loadMore = async () => {
    // const nextPage = pageInfo.page + 1;
    setPageInfo((prev) => ({
      ...prev,
      page: prev.page + 1,
    }));
    console.log('pageInfo', pageInfo)
    await fetchTaskDetails(true, false);
  };

  // 刷新数据
  const refreshData = async () => {
    let pageInfo = {
      pageSize: 10,   
      page: 1,
      totalCount: 0,
    }
    setPageInfo(pageInfo);
    await fetchTaskDetails(false, pageInfo);
    message.success('数据已刷�?);
  };

  const Ref_MineTaskInfo = useRef<MineTaskInfoRef>(null);
  const Ref_Withdraw = useRef<WithdrawRef>(null);

  async function withdraw(task: UserTask<Task<TaskDataInfo>>) {
    Ref_Withdraw.current?.init(task);
  }

  // 打开指南弹窗
  const openGuideModal = () => {
    setIsGuideModalVisible(true);
  };

  // 关闭指南弹窗
  const closeGuideModal = () => {
    setIsGuideModalVisible(false);
  };

  // 格式化日�?
  const formatDate = (dateString?: string) => {
    if (!dateString) return '暂无日期';
    return dayjs(dateString).format('YYYY/MM/DD HH:mm');
  };

  // 查看任务详情
  const viewTaskDetail = (task: UserTask<Task<TaskDataInfo>>) => {
    Ref_MineTaskInfo.current?.init(task);
  };


  return (
    <div className={styles.mineTaskContainer}>
      {/* <MineTaskInfo ref={Ref_MineTaskInfo} onTaskSubmitted={refreshTaskList} /> */}
      <MineTaskInfo ref={Ref_MineTaskInfo} />
      <Withdraw ref={Ref_Withdraw} />

      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>我的任务</h2>
        <div className={styles.pageActions}>
          <Space size={12}>
            <Select
              className={styles.statusFilter}
              placeholder="筛选任务状�?
              allowClear
              style={{ width: 150 }}
              onChange={(value) => setStatusFilter(value)}
              value={statusFilter}
              options={Array.from(UserTaskStatusNameMap).map(
                ([value, label]) => ({
                  value,
                  label,
                }),
              )}
              suffixIcon={<FilterOutlined />}
            />
            <Button
              className={styles.refreshButton}
              icon={<ReloadOutlined />}
              onClick={refreshData}
            >
              刷新
            </Button>
            <Button
              type="primary"
              onClick={openGuideModal}
              icon={<QuestionCircleOutlined />}
            >
              接单指南
            </Button>
          </Space>
        </div>
      </div>

      {loading && taskList.length === 0 ? (
        <div className={styles.loadingContainer}>
          <Spin size="large" />
        </div>
      ) : taskList.length == 0 ? (
        <div className={styles.emptyContainer}>
          <Empty description={false} />
          <div className={styles.emptyText}>
            <p>您还没有接受任何任务，可以前往任务市场查看更多任务</p>
          </div>
          {renderEmptyState()}
        </div>
      ) : (
        <div className={styles.taskList}>
          {taskList.map((task:any) => {
            // 获取任务详情，处理可能的undefined情况
            const taskDetail = task.taskId || {};

            return (
              <Card key={task._id} className={styles.taskCard} bordered={false}>
                <div className={styles.taskCardContent}>
                  {/* 添加任务图片显示 */}
                  <div className={styles.taskImageContainer}>
                    <img
                      src={` ${ task.taskId?.imageUrl ? FILE_BASE_URL+ task.taskId?.imageUrl: logo }`}
                      alt={taskDetail.title}
                      className={styles.taskImage}
                    />
                  </div>

                  <div className={styles.taskInfo}>
                    <div className={styles.taskHeader}>
                      <h3 className={styles.taskTitle}>
                        {taskDetail.title || '未知任务'}
                        <span className={styles.taskId}>
                          订单�? {task._id}
                        </span>
                      </h3>
                      <div className={styles.tagContainer}>
                        {/* 添加任务类型标签 */}
                        <Tag
                          color={
                            (TASK_TYPE_MAP as any)[task.taskId?.type]?.color ||
                            '#a66ae4'
                          }
                          className={styles.typeTag}
                        >
                          {(TASK_TYPE_MAP as any)[task.taskId?.type]?.name ||
                            '视频任务'}
                        </Tag>

                        {/* 原有的状态标�?*/}
                        <Tag
                          color={
                            UserTaskStatusColorMap.get(
                              task.status as UserTaskStatus,
                            ) || 'default'
                          }
                          className={styles.statusTag}
                        >
                          {UserTaskStatusNameMap.get(
                            task.status as UserTaskStatus,
                          ) || '未知状�?}
                        </Tag>
                      </div>
                    </div>

                    <div className={styles.taskDetails}>
                      <div className={styles.taskDetail}>
                        <ClockCircleOutlined className={styles.detailIcon} />
                        <span className={styles.detailLabel}>接单时间:</span>
                        <span className={styles.detailValue}>
                          {formatDate(task.createTime)}
                        </span>
                      </div>

                      <div className={styles.taskDetail}>
                        <FileTextOutlined className={styles.detailIcon} />
                        <span className={styles.detailLabel}>任务要求:</span>
                        <span className={styles.detailValue}>
                          {taskDetail.requirement || '不许删文'}
                        </span>
                      </div>

                      <div className={styles.taskDetail}>
                        <DollarOutlined className={styles.detailIcon} />
                        <span className={styles.detailLabel}>任务奖励:</span>
                        <span className={styles.detailValue}>
                          ¥{taskDetail.reward || 5}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.taskAction}>
                    {/* {(task.status === UserTaskStatus.APPROVED ||
                      task.status === UserTaskStatus.COMPLETED ||
                      task.status === UserTaskStatus.REWARDED) && (
                      <Button
                        type="primary"
                        danger
                        className={styles.withdrawButton}
                        style={{
                          backgroundColor: '#a66ae4',
                          borderColor: '#a66ae4',
                          color: 'white',
                          marginBottom: '10px',
                        }}
                        onClick={() => withdraw(task)}
                      >
                        申请提现 <RightOutlined />
                      </Button>
                    )} */}

                    <Button
                      className={styles.viewButton}
                      onClick={() => viewTaskDetail(task)}
                      style={{
                        backgroundColor: '#a66ae4',
                        borderColor: '#a66ae4',
                        color: 'white',
                      }}
                    >
                      查看详情 <RightOutlined />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {loading && (
            <div className={styles.loadingContainer}>
              <Spin size="large" />
            </div>
          )}

          {/* 添加加载更多触发�?*/}
          <div ref={loadMoreRef} className={styles.loadMoreTrigger}>
            {!loading && hasMore && (
              <div className={styles.loadMoreContainer}>
                <Button type="link" loading={loading}>
                  {loading ? '加载�?..' : '加载更多'}
                </Button>
              </div>
            )}
            {!loading && !hasMore && taskList.length > 0 && (
              <div className={styles.loadMoreContainer}>
                <span style={{ color: '#999' }}>没有更多任务�?/span>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        title="接单指南"
        open={isGuideModalVisible}
        onCancel={closeGuideModal}
        footer={null}
        width={800}
        className={styles.guideModal}
      >
        <div className={styles.guideContainer}>
          <div className={styles.guideHeader}>
            <h2>如何接单赚钱</h2>
            <div className={styles.guideDate}>更新时间: 2025�?�?6�?/div>
          </div>

          <div className={styles.guideIntro}>
          <p>
            �𾴵�VideoFlow�������û���
            </p>
            <p>
              ���ã�Ϊ�˸��õر��Ϲ��������������Ȩ�棬����һ����������ƽ�Ĺ�潻��ϵͳ������ϸ�Ķ���ȷ������"��VideoFlow�����г��ӵ�������֪��"���ٲ����ӵ���
            </p>
            <p>
              VideoFlow�����г�����ָVideoFlowΪ�������͹�����ṩ�Ĵ�Ͻ����Լ�����֧�ַ���VideoFlow�ڴ˹������ṩƽ̨����Ӫ��ά�����ල����ƽ̨�ھ�Ӫ���弰������Ϊ��������������������������顣
            </p>
          </div>

          <div className={styles.guideSection}>
            <h3>操作步骤</h3>
            <ol className={styles.guideSteps}>
              <li>
                <p>关注公众�?任务市场"，获取最新任务通知和平台动态�?/p>
                <div className={styles.qrCodeContainer}>
                  <div className={styles.qrCodeItem}>
                    <div className={styles.qrCodeWrapper}>
                      <img
                        src={qr2}
                        alt="任务市场公众�?
                        className={styles.qrCode}
                      />
                    </div>
                    <div className={styles.qrCodeText}>任务市场公众�?/div>
                    <div className={styles.qrCodeSubtext}>获取最新任务通知</div>
                  </div>
                </div>
              </li>
              <li>
                <p>点击下方链接下载哎哟赚接单软件（已下载可忽略�?/p>
                <p className={styles.guideLink}>https://example.com/videoflow</p>
              </li>
              <li>
                <p>
                  【账号】添加小红书、抖音、视频号、B站等平台账号，等�?天左右，可以前往【任务市场】查看任务和接单（如下图�?
                </p>
                <div className={styles.guideImageContainer}>
                  <img
                    src={bindTaskImg}
                    alt="管理中心-添加账号"
                    className={styles.guideImage}
                  />
                  <p className={styles.guideImageCaption}>管理中心-添加账号</p>
                </div>
                <p>列表会展示添加成功的账号</p>
                <div className={styles.guideImageContainer}>
                  <img
                    src={checkTaskImg}
                    alt="绑定账号后等�?天左右会显示项目"
                    className={styles.guideImage}
                  />
                  <p className={styles.guideImageCaption}>
                    绑定账号后等�?天左右会显示项目
                  </p>
                </div>
              </li>
              <li>
                <p>
                  耐心等待任务下发，任务下发后，请仔细判断是否符合自己账号调性，确认合适再进行发布，一旦发布不可删除，否则必须补发且影响您后续得到派单�?
                </p>
              </li>
              <li>
                <p>
                  建议日常无单时积极运营账号，保持真诚、分享、有用的人设，有利于后续接到更多高质量的订单。连续接广告无原创内容、不经常更新、批量做矩阵账号都是封号高危原因，对后续发展不利�?
                </p>
              </li>
            </ol>
          </div>

          <div className={styles.guideSection}>
            <h3>常见问题</h3>
            <div className={styles.guideFaq}>
              <div className={styles.faqItem}>
                <h4>一.关于流量主账�?/h4>
                <div className={styles.faqAnswer}>
                  <p>
                  1.1�����������и�����VideoFlowƽ̨���û��˺ź����룬��������û��˺������·��������л�������������ڷ���������Ϣ�����ϵ��ͬ�����Э�顢���򡢲�������Ͷ��ȣ��е����Ρ���������Ȩ������Ҫ���ĵ�¼���˻��������롣�����������Ĺ������µ��κ���ʧ�����������ге����ù��������������ڣ������ս�����ʾ������δ��ʱ���н��ײ�����������й©����ȡ�
                  </p>
                  <p >
                  1.2������Ӧ��ע���˻�ʱ�ṩ��ʵ׼ȷ��ע����Ϣ����������������ʵ����������֤�š���ϵ�绰����ַ����������ȣ���֤VideoFlow������Ա����ͨ��������ϵ��ʽ��������������ϵ�����ͬʱ��������ҲӦ�����������ʵ�ʱ��ʱ��ʱ�����й�ע�����ϡ�
                  </p>
                </div>
              </div>

              <div className={styles.faqItem}>
                <h4>�?推广内容审核说明</h4>
                <div className={styles.faqAnswer}>
                  <p>
                  2.1����ƹ����ݣ�VideoFlow�����г�ƽ̨��Ȩ�Թ����Ͷ�����ݽ��г�����ˣ�����������������Υ�����ɷ�������ݽ���ǿ���Դ�������ƽ̨����˽�Ϊ��ʽ��ˣ����ڲ��չ�淨���������ˣ�����ÿ���罻ý��ƽ̨�������������ɵ�����Υ����¼ܣ�VideoFlow���е�������Ρ�
                  </p>
                  <p>2.2流量主在接受推广任务前，请自行判断可能带来的不确定性风险，我方不承担任何因推广素材造成的包括但不限于系统删文、禁言及封号、隐藏限流等责任�?/p>
                </div>
              </div>

              <div className={styles.faqItem}>
                <h4>�?发布与结�?/h4>
                <div className={styles.faqAnswer}>
                  <p>3.1流量主如约完成推送后，推广信息因相关政策或其它非流量主主动因素导致被删除（包括但不限于：用户举报、平台通知配合删除等），如账号数据正常、账号质量过关且在结算期内，VideoFlow任务市场平台应当按照统计金额向乙方支付费用�?/p>
                  <p>3.2流量主发布订单内容后，因自身原因人为删除、隐藏、账号封禁等情况导致广告主推广内容不能正常展示推广的，须按照对应订单要求补发或协商处理，否则会受到相应接单限制或处罚�?/p>
                  <p>3.3流量主不得擅自更改接单推广信息，包括但不限于标题、图片、视频、音频、文字等（与VideoFlow任务市场工作人员沟通确认后的更改除外），如擅自更改将不予结算并影响接单权限�?/p>
                  <p>3.4VideoFlow�����г�����ʵ�з�������㷽ʽ��������ʵʱ����������VideoFlow�˻����������������ֲ�����ƽ̨����ȡ���ַ���ѡ�</p>
                </div>
              </div>

              <div className={styles.faqItem}>
                <h4>违规提示或账号封禁怎么处理�?/h4>
                <div className={styles.faqAnswer}>
                  <p>将订单号和违规截图私聊发给工作人员�?/p>
                  <p>如未回复消息请耐心等待（工作时间：工作�?:00-18:00�?/p>
                  <p>前往哎哟赚查看更多新媒体相关信息</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}