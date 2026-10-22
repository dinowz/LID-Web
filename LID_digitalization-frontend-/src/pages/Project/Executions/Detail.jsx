import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Form, Select, Input, DatePicker, message, Spin, Row, Col, Progress, Slider, Timeline, Alert, Table, Tabs } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, SaveOutlined, FileTextOutlined,
  HistoryOutlined, SyncOutlined, ClockCircleOutlined, CheckCircleOutlined, ArrowRightOutlined, ToolOutlined,
  UserOutlined, InfoCircleOutlined, PushpinOutlined, EnvironmentOutlined
} from '@ant-design/icons';
import usePermissions from '../../../hooks/usePermissions';
import dayjs from 'dayjs';
import { getProjectById, updateProject } from '../../../services/project.service';
import useUnsavedChangesWarning from '../../../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../../../components/UnsavedChangesModal';

const { Option } = Select;
const { TextArea } = Input;

const STATUS_COLOR = {
  PENDING: 'orange',
  IN_PROGRESS: 'blue',
  DONE: 'green',
};

const PROJECT_TYPE_LABELS = {
  OM: 'O&M',
  NEW_PLANT: 'New Plant',
  UPGRADE: 'Upgrade',
};

export default function ProjectExecutionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const isOnlyTfs = permissions.roles.includes('TFS') && !permissions.roles.includes('ADMIN') && !permissions.roles.includes('PROJECT');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { blocker, isDirty, setIsDirty } = useUnsavedChangesWarning();
  const [form] = Form.useForm();

  // Watch for progress and status changes
  const progressVal = Form.useWatch('progressPercentage', form) || 0;
  const currentStatus = Form.useWatch('status', form);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const data = await getProjectById(id);
      setProject(data);

      form.setFieldsValue({
        status: data.status || 'PENDING',
        picName: data.picName,
        projectName: data.projectName,
        progressPercentage: data.progressPercentage || 0,
        startDate: data.startDate ? dayjs(data.startDate) : null,
        targetDate: data.targetDate ? dayjs(data.targetDate) : null,
        completedDate: data.completedDate ? dayjs(data.completedDate) : null,
        progressNote: '', // Clear after saving
        issue: '',
        nextAction: '',
        description: data.description,
      });
    } catch {
      message.error('Failed to load project data');
      navigate('/project/executions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProject(); }, [id]);

  const handleUpdate = async (values) => {
    setSaving(true);
    try {
      const payload = {
        status: values.status,
        progressPercentage: values.progressPercentage,
        picName: values.picName,
        projectName: values.projectName,
        progressNote: values.progressNote,
        issue: values.issue,
        nextAction: values.nextAction,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        targetDate: values.targetDate ? values.targetDate.format('YYYY-MM-DD') : null,
        completedDate: values.completedDate ? values.completedDate.format('YYYY-MM-DD') : null,
        description: values.description,
      };

      await updateProject(id, payload);
      setIsDirty(false);
      message.success('Project progress updated');
      fetchProject();
    } catch {
      message.error('Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!project) return null;

  const isCompletedOrClosed = project.status === 'DONE';
  const isPending = currentStatus === 'PENDING';

  // Calculate Target vs Actual
  const isOverdue = project.targetDate && !project.completedDate && dayjs().isAfter(dayjs(project.targetDate));
  const completedLate = project.targetDate && project.completedDate && dayjs(project.completedDate).isAfter(dayjs(project.targetDate));

  return (
    <>
      <UnsavedChangesModal blocker={blocker} />
      <div className="space-y-6 max-w-7xl mx-auto mb-10 px-4">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-800">{project.projectNumber}</h1>
              <Tag color={STATUS_COLOR[project.status] || 'default'}>{project.status}</Tag>
            </div>
            <p className="text-sm text-gray-500">Project Execution Detail</p>
          </div>
          <div className="flex gap-2">
            <Button icon={<ArrowLeftOutlined style={{ fontSize: 14 }} />} onClick={() => navigate('/project/executions')}>Back</Button>
          </div>
        </div>

        {/* Main Content */}
        <Row gutter={[32, 24]}>
          {/* LEFT COLUMN: Input & Details */}
          <Col xs={24} lg={12}>
            <div className="flex flex-col gap-5">
              {/* Update Form */}
              <Card title={<><EditOutlined style={{ fontSize: 16 }} className="inline mr-2" />Update Project Progress</>} className="rounded-xl shadow-sm border-gray-100">
                <Form form={form} layout="vertical" onFinish={handleUpdate} disabled={isCompletedOrClosed || !permissions.canEditProject || isOnlyTfs} onValuesChange={() => setIsDirty(true)}>
                  <Tabs defaultActiveKey="1" items={[
                    {
                      key: '1',
                      label: 'Progress & Status',
                      children: (
                        <>
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                                <Select>
                                  <Option value="PENDING">PENDING</Option>
                                  <Option value="IN_PROGRESS">IN PROGRESS</Option>
                                  <Option value="DONE">DONE</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label={`Progress: ${progressVal}%`} name="progressPercentage">
                                <Slider min={0} max={100} marks={{ 0: '0%', 50: '50%', 100: '100%' }} disabled={isPending} />
                              </Form.Item>
                            </Col>
                          </Row>
                          {isPending && (
                            <Alert
                              message="Status masih PENDING"
                              description="Ubah status ke IN PROGRESS terlebih dahulu untuk dapat mengedit progress."
                              type="info"
                              showIcon
                              className="mb-4 rounded-lg"
                            />
                          )}
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item name="projectName" label="Project Name" rules={[{ required: true }]}>
                                <Input placeholder="Project Name" disabled={isPending} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="picName" label="PIC / Project Manager Name">
                                <Input placeholder="Person In Charge Name" disabled={isPending} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item name="startDate" label="Actual Start Date">
                                <DatePicker className="w-full" format="DD MMM YYYY" disabled={isPending} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="completedDate" label="Actual Completion Date">
                                <DatePicker className="w-full" format="DD MMM YYYY" disabled={isPending} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={16}>
                            <Col span={24}>
                              <Form.Item name="targetDate" label="Target Completion">
                                <DatePicker className="w-full" format="DD MMM YYYY" disabled={isPending} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Form.Item name="progressNote" label="Today's Progress">
                            <TextArea rows={3} placeholder="Describe what has been worked on..." disabled={isPending} />
                          </Form.Item>
                        </>
                      )
                    },
                    {
                      key: '2',
                      label: 'Obstacles & Actions',
                      children: (
                        <>
                          <Form.Item name="issue" label="Issue / Obstacle">
                            <TextArea rows={3} placeholder="Are there any obstacles on site?" />
                          </Form.Item>
                          <Form.Item name="nextAction" label="Next Action">
                            <TextArea rows={3} placeholder="What is the next action?" />
                          </Form.Item>
                          <Form.Item name="description" label="Project Description / Remarks">
                            <TextArea rows={2} placeholder="Project description..." />
                          </Form.Item>
                        </>
                      )
                    }
                  ]} />

                  <div className="flex justify-end mt-4">
                    {permissions.canEditProject && !isOnlyTfs && (
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined style={{ fontSize: 16 }} />} loading={saving} disabled={isCompletedOrClosed} className={isCompletedOrClosed ? '' : 'bg-primary-600'}>
                        Save Progress
                      </Button>
                    )}
                  </div>
                </Form>
              </Card>

            </div>
          </Col>

          {/* RIGHT COLUMN: Monitoring & Reports */}
          <Col xs={24} lg={12}>
            <div className="flex flex-col gap-5">

              {/* Visual Progress */}
              <Card className="rounded-xl shadow-sm border-gray-100 text-center relative">
                <h3 className="text-gray-500 mb-4 font-medium text-sm">OVERALL PROGRESS</h3>

                {/* Schedule Indicator */}
                <div className="absolute top-4 right-4">
                  {isCompletedOrClosed ? (
                    completedLate ? <Tag color="orange" className="m-0 font-bold">COMPLETED LATE</Tag> : <Tag color="green" className="m-0 font-bold">ON TIME</Tag>
                  ) : (
                    isOverdue ? <Tag color="red" className="m-0 font-bold">OVERDUE</Tag> : <Tag color="blue" className="m-0 font-bold">ON TRACK</Tag>
                  )}
                </div>

                <Progress
                  type="dashboard"
                  percent={project.progressPercentage || 0}
                  status={isCompletedOrClosed ? 'success' : (project.progressPercentage === 100 ? 'normal' : 'active')}
                  size={180}
                  strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                />

                {/* Planned vs Actual Summary */}
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center px-4">
                    <span className="text-xs text-gray-500 text-left">Target Completion</span>
                    <span className="text-sm font-medium">{project.targetDate ? dayjs(project.targetDate).format('DD MMM YYYY') : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center px-4">
                    <span className="text-xs text-gray-500 text-left">Actual Completion</span>
                    <span className="text-sm font-medium">{project.completedDate ? dayjs(project.completedDate).format('DD MMM YYYY') : '-'}</span>
                  </div>
                </div>
              </Card>

              {/* Job Info Summary */}
              <Card className="rounded-xl shadow-sm border-gray-100">
                <Descriptions title="Project Info Summary" bordered column={1} size="small">
                  <Descriptions.Item label="Project Name">{project.projectName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Project Type">{PROJECT_TYPE_LABELS[project.projectType] || project.projectType || '-'}</Descriptions.Item>
                  <Descriptions.Item label="PIC / Manager">{project.picName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="No. PO">{project.purchaseOrder?.poNumber || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Timeline History */}
              <Card title={<><HistoryOutlined style={{ fontSize: 18 }} className="inline mr-2" />Change History</>} className="rounded-xl shadow-sm border-gray-100">
                <Timeline>
                  {project.histories && project.histories.length > 0 ? (
                    project.histories.map((h, i) => (
                      <Timeline.Item key={h.id} color={h.newStatus === 'DONE' ? 'green' : 'blue'}>
                        <div className="mb-1 flex items-center justify-between">
                          <Tag color={STATUS_COLOR[h.newStatus] || 'default'} className="text-[10px] m-0">{h.newStatus}</Tag>
                          <span className="text-[10px] text-gray-400">{dayjs(h.createdAt).format('DD MMM YYYY, HH:mm')}</span>
                        </div>

                        {h.oldProgress !== h.newProgress && (
                          <div className="text-xs font-medium text-gray-700 mt-1">
                            Progress: <span className="line-through text-gray-400">{h.oldProgress}%</span> <ArrowRightOutlined /> <span className="text-blue-600">{h.newProgress}%</span>
                          </div>
                        )}

                        {h.progressNote && (
                          <div className="mt-2 bg-blue-50/50 p-2 rounded text-xs text-gray-600 border border-blue-100">
                            {h.progressNote}
                          </div>
                        )}
                        {h.issue && (
                          <div className="mt-1 bg-red-50/50 p-2 rounded text-xs text-red-600 border border-red-100">
                            <strong>Issue:</strong> {h.issue}
                          </div>
                        )}
                        {h.nextAction && (
                          <div className="mt-1 bg-green-50/50 p-2 rounded text-xs text-green-600 border border-green-100">
                            <strong>Next:</strong> {h.nextAction}
                          </div>
                        )}

                        {h.changer && (
                          <div className="mt-1 text-[10px] text-gray-400 text-right">
                            By: {h.changer.name}
                          </div>
                        )}
                      </Timeline.Item>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 py-4 text-xs italic">No change history yet</div>
                  )}
                </Timeline>
              </Card>
            </div>
          </Col>
        </Row>

      </div>
    </>
  );
}
