import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ToolOutlined, FileTextOutlined, ThunderboltOutlined,
  CheckCircleOutlined, WarningOutlined, InfoCircleOutlined,
  PlusOutlined, FileAddOutlined, AppstoreOutlined,
  DownloadOutlined, RightOutlined, ClockCircleOutlined,
  ShoppingCartOutlined, InboxOutlined, DollarCircleOutlined,
  CarOutlined, SettingOutlined, ProjectOutlined, AuditOutlined
} from '@ant-design/icons';
import {
  LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, PieChart, Pie, LabelList
} from 'recharts';
import { Select } from 'antd';
import api from '../api/axiosClient';
import usePermissions from '../hooks/usePermissions';

// Role color palette
const ROLE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];

// Custom Tooltip component for Overview Chart
const OverviewTooltip = ({ active, payload, label, monthlyTargetPerRole }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-100 text-xs min-w-[160px]">
        <p className="font-bold text-gray-900 mb-2">{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex justify-between gap-4 mb-1">
            <span style={{ color: entry.fill }} className="font-medium">{entry.dataKey}</span>
            <span className="font-bold">{entry.value} hari</span>
          </div>
        ))}
        {monthlyTargetPerRole && Object.keys(monthlyTargetPerRole).length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            {Object.entries(monthlyTargetPerRole).map(([role, target]) => (
              <div key={role} className="flex justify-between gap-4 text-gray-400">
                <span>Target {role}</span>
                <span>{target} hari</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Services
import { getInquiries } from '../services/inquiry.service';
import { getServices } from '../services/service.service';
import { getProjects } from '../services/project.service';
import { getInvoices, getReadyToInvoiceList } from '../services/invoice.service';
import { getDeliveries } from '../services/delivery.service';

// ─── Stat Card (top row) ──────────────────────────────────────────────────────
const StatCard = ({ title, value, sub, subColor, icon: Icon, iconColor, loading }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold tracking-widest uppercase text-gray-400">{title}</span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-100`}>
        <Icon style={{ fontSize: 16 }} className={iconColor || 'text-gray-500'} />
      </div>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-[32px] font-bold text-gray-900 leading-none tabular-nums">
        {loading ? <span className="text-gray-200">—</span> : value}
      </span>
      {sub && (
        <span className={`text-xs font-medium ${subColor || 'text-gray-400'}`}>{sub}</span>
      )}
    </div>
  </div>
);

// ─── Progress Bar Row ─────────────────────────────────────────────────────────
const ProgressRow = ({ label, pct, loading }) => (
  <div className="mb-5">
    <div className="flex justify-between items-baseline mb-1.5">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-500">{loading ? '—' : `${pct}% Complete`}</span>
    </div>
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-emerald-600 transition-all duration-700"
        style={{ width: loading ? '0%' : `${pct}%` }}
      />
    </div>
  </div>
);

// ─── Alert Row ────────────────────────────────────────────────────────────────
const AlertItem = ({ icon: Icon, iconColor, iconBg, title, subtitle }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
    <div className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
      <Icon style={{ fontSize: 13 }} className={iconColor} />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-800 leading-snug">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
    </div>
  </div>
);

// ─── Quick Action Button ──────────────────────────────────────────────────────
const QuickBtn = ({ label, to, icon: Icon, colorClass = 'emerald' }) => {
  const colorMap = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', text: 'text-emerald-700', hoverBg: 'hover:bg-emerald-100' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', text: 'text-blue-700', hoverBg: 'hover:bg-blue-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', text: 'text-purple-700', hoverBg: 'hover:bg-purple-100' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', text: 'text-amber-700', hoverBg: 'hover:bg-amber-100' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-600', text: 'text-rose-700', hoverBg: 'hover:bg-rose-100' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', icon: 'text-sky-600', text: 'text-sky-700', hoverBg: 'hover:bg-sky-100' },
  };
  const c = colorMap[colorClass] || colorMap.emerald;
  return (
    <Link
      to={to}
      className={`w-full flex flex-col items-center justify-center gap-3 px-4 py-5 rounded-xl border ${c.border} ${c.bg} ${c.hoverBg} transition-all duration-200 hover:shadow-sm group`}
    >
      <div className={`w-12 h-12 rounded-xl bg-white border ${c.border} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200`}>
        <Icon style={{ fontSize: 22 }} className={c.icon} />
      </div>
      <span className={`text-[12px] font-semibold ${c.text} text-center leading-tight`}>{label}</span>
    </Link>
  );
};

// ─── Resource Utilization Card ────────────────────────────────────────────────
const ResourceUtilizationCard = ({ stats, loading, selectedMonth, onMonthChange, overviewData, selectedOverviewRole = 'all', onOverviewRoleChange }) => {
  const monthOptions = [
    { value: 'today', label: 'today' },
    { value: 0, label: 'Jan' },
    { value: 1, label: 'Feb' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Apr' },
    { value: 4, label: 'Mei' },
    { value: 5, label: 'Jun' },
    { value: 6, label: 'Jul' },
    { value: 7, label: 'Agu' },
    { value: 8, label: 'Sep' },
    { value: 9, label: 'Okt' },
    { value: 10, label: 'Nov' },
    { value: 11, label: 'Des' }
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h2 className="text-base font-bold text-gray-900">Resource Utilization</h2>
          <Link to="/tfs/scheduled" className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1 mt-0.5">
            Manage Personnel <RightOutlined style={{ fontSize: 11 }} />
          </Link>
        </div>
        <Select
          size="small"
          value={selectedMonth}
          onChange={onMonthChange}
          options={monthOptions}
          className="w-[90px] text-xs"
          disabled={loading}
        />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-8 bg-gray-50 rounded" />
              <div className="h-8 bg-gray-50 rounded" />
            </div>
          </div>
          <div className="h-24 bg-gray-50 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="flex items-center gap-6">
            {/* Pie Chart */}
            <div className="relative w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: 'Utilized',
                        value: stats.utilizationMandays
                      },
                      {
                        name: 'Remaining',
                        value: Math.max(
                          stats.targetMandays - stats.utilizationMandays,
                          0
                        )
                      }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={26}
                    outerRadius={42}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill="#6366f1" />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-800">
                  {Number(stats.utilizationPercentage || 0).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-1 gap-2">
              <div className="flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded-lg">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Total</span>
                <span className="text-sm font-bold">{stats?.total || 0}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-1.5 bg-blue-50 rounded-lg">
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-tight">Active</span>
                <span className="text-sm font-bold text-blue-700">{stats?.onAssignment || 0}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-1.5 bg-emerald-50 rounded-lg">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">Ready</span>
                <span className="text-sm font-bold text-emerald-700">{stats?.available || 0}</span>
              </div>
            </div>
          </div>

          {/* Breakdown by Role */}
          <div className="space-y-3">
            {/* TFS Manday Utilization Pie */}
            {stats?.targetMandays > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  {/* Labels */}
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-500 shrink-0" />
                      <span className="text-[10px] text-gray-500 font-medium">
                        Utilized: <span className="font-bold text-gray-900">{stats.utilizationMandays.toLocaleString()} MD</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-200 shrink-0" />
                      <span className="text-[10px] text-gray-500 font-medium">
                        Target: <span className="font-bold text-gray-700">{stats.targetMandays.toLocaleString()} MD (YTD)</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Utilization by Role</p>
            <div className="h-48 w-full">
              {stats?.byRole && stats.byRole.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.byRole}
                    layout="vertical"
                    margin={{ top: 5, right: 35, left: 15, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis
                      type="number"
                      domain={[0, 1]}
                      ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                      tickFormatter={(val) => `${Math.round(val * 100)}%`}
                      tick={{ fontSize: 9, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="role"
                      tick={{ fontSize: 9, fill: '#4b5563', width: 80 }}
                      axisLine={false}
                      tickLine={false}
                      width={80}
                    />
                    <Tooltip
                      formatter={(value, name, props) => [
                        `${(value * 100).toFixed(1)}% (${props.payload.utilizationMandays} / ${props.payload.targetMandays} MD)`,
                        'Utilization'
                      ]}
                      contentStyle={{ fontSize: '10px', borderRadius: '6px' }}
                    />
                    <Bar
                      dataKey="utilizationRatio"
                      fill="#6366f1"
                      radius={[0, 3, 3, 0]}
                      maxBarSize={12}
                    >
                      <Cell fill="#6366f1" />
                      {stats.byRole.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                      ))}
                      <LabelList
                        dataKey="utilizationRatio"
                        position="right"
                        formatter={(val) => `${(val * 100).toFixed(1)}%`}
                        style={{ fill: '#4b5563', fontSize: 9, fontWeight: 'bold' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-400 italic">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overview Chart */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Yearly Overview vs Target</h3>
          <Select
            size="small"
            value={selectedOverviewRole}
            onChange={onOverviewRoleChange}
            options={[
              { value: 'all', label: 'ALL TFS role' },
              ...(overviewData.roles || []).map(r => ({ value: r, label: r }))
            ]}
            className="w-[150px] text-xs"
            disabled={loading}
          />
        </div>
        <div className="h-60 w-full">
          {(() => {
            const isAll = selectedOverviewRole === 'all';
            const barColor = isAll
              ? '#6366f1'
              : (ROLE_COLORS[((overviewData.roles || []).indexOf(selectedOverviewRole)) % ROLE_COLORS.length] || '#6366f1');

            const totalTarget = Object.values(overviewData.monthlyTargetPerRole || {}).reduce((sum, v) => sum + Number(v), 0);
            const annualTarget = isAll ? totalTarget : (overviewData.monthlyTargetPerRole?.[selectedOverviewRole] || 0);

            // Determine current month index (0-based) for the selected year to cap cumulative line
            const now = new Date();
            const selectedYear = parseInt((overviewData.data?.[0]?.month || '').slice(-2)) + 2000;
            const currentYear = now.getFullYear();
            const currentMonthIdx = (selectedYear === currentYear || isNaN(selectedYear)) ? now.getMonth() : 11;

            let ytdTotalActual = 0;
            const chartData = (overviewData.data || []).map((item, idx) => {
              const actual = isAll
                ? (overviewData.roles || []).reduce((sum, r) => sum + (item[r] || 0), 0)
                : (item[selectedOverviewRole] || 0);
              if (idx <= currentMonthIdx) ytdTotalActual += actual;
              return {
                month: item.month,
                Actual: actual,
                Target: annualTarget,
                YTDActual: ytdTotalActual,
              };
            });

            return (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: '10px', borderRadius: '6px', border: '1px solid #f3f4f6' }}
                    formatter={(value, name) => [
                      value !== null && value !== undefined ? `${value} MD` : '—',
                      name
                    ]}
                    cursor={{ fill: '#f9fafb' }}
                  />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: '9px', paddingTop: '6px' }}
                    formatter={(value) =>
                      value === 'Actual' ? `Actual (${isAll ? 'ALL' : selectedOverviewRole})`
                        : value === 'Target' ? `Annual Target (${annualTarget} MD)`
                          : `YTD Actual (${ytdTotalActual} MD)`
                    }
                  />
                  {/* Monthly actual bar */}
                  <Bar dataKey="Actual" fill={barColor} radius={[3, 3, 0, 0]} maxBarSize={20} opacity={0.85} />
                  {/* Line for Target to ensure Legend item and Y-Axis scaling */}
                  <Line
                    dataKey="Target"
                    name="Target"
                    type="monotone"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={false}
                  />
                  {/* Annual target flat line */}
                  {annualTarget > 0 && (
                    <ReferenceLine
                      y={annualTarget}
                      ifOverflow="extendDomain"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      label={{
                        value: `Target (${annualTarget} MD)`,
                        position: 'top',
                        fill: '#64748b',
                        fontSize: 9,
                        fontWeight: 'bold'
                      }}
                    />
                  )}
                  {/* Flat horizontal line for YTD Actual (1 Jan - Today) */}
                  {ytdTotalActual > 0 && (
                    <ReferenceLine
                      y={ytdTotalActual}
                      ifOverflow="extendDomain"
                      stroke={barColor}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{
                        value: `YTD (${ytdTotalActual} MD)`,
                        position: 'top',
                        fill: barColor,
                        fontSize: 9,
                        fontWeight: 'bold'
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// ─── Pipeline Overview Chart ──────────────────────────────────────────────────
const FLOW_COLORS = {
  sparepart: { quotation: '#3b82f6', po: '#6ee7b7' },
  service: { quotation: '#3b82f6', po: '#6ee7b7' },
  project: { quotation: '#3b82f6', po: '#6ee7b7' },
};

const CustomPipelineTooltip = ({ active, payload, label, fmt }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-100 min-w-[200px]">
        <p className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1">{label}</p>
        <div className="space-y-3">
          {payload.map((entry, index) => {
            let count = 0;
            if (entry.dataKey === 'totalQuotation') count = entry.payload.totalQCount || 0;
            else if (entry.dataKey === 'totalPO') count = entry.payload.totalPoCount || 0;
            else if (entry.dataKey === 'sparepartQuotationAmt') count = entry.payload.sparepartQuotation || 0;
            else if (entry.dataKey === 'sparepartPOAmt') count = entry.payload.sparepartPO || 0;
            else if (entry.dataKey === 'serviceQuotationAmt') count = entry.payload.serviceQuotation || 0;
            else if (entry.dataKey === 'servicePOAmt') count = entry.payload.servicePO || 0;
            else if (entry.dataKey === 'projectQuotationAmt') count = entry.payload.projectQuotation || 0;
            else if (entry.dataKey === 'projectPOAmt') count = entry.payload.projectPO || 0;

            return (
              <div key={index} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-semibold text-gray-700">{entry.name}:</span>
                  <span className="text-xs font-bold text-gray-900 ml-auto">{fmt(entry.value, 'IDR')}</span>
                </div>
                <div className="flex items-center gap-1.5 pl-4">
                  <span className="text-[10px] text-gray-400">Jumlah dokumen:</span>
                  <span className="text-[10px] font-semibold text-gray-600">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const PIPELINE_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PipelineChart = ({ pipelineData, pipelineLoading, selectedYear, availableYears, onYearChange, fmt, target }) => {
  const [viewMode, setViewMode] = useState('all'); // all, sparepart, service, project

  const processedData = pipelineData.map(m => ({
    ...m,
    totalQuotation: m.totalQAmtIdrEquiv || 0,
    totalPO: m.totalExecutedOnlyAmt || 0,
    totalQCount: (m.sparepartQuotation || 0) + (m.serviceQuotation || 0) + (m.projectQuotation || 0),
    totalPoCount: m.totalExecutedOnlyCount || 0,
    sparepartQuotationAmt: m.sparepart?.qAmtIdrEquiv || 0,
    sparepartPOAmt: m.sparepartExecutedOnlyAmt || 0,
    sparepartPO: m.sparepartExecutedOnlyCount || 0,
    serviceQuotationAmt: m.service?.qAmtIdrEquiv || 0,
    servicePOAmt: m.serviceExecutedOnlyAmt || 0,
    servicePO: m.serviceExecutedOnlyCount || 0,
    projectQuotationAmt: m.project?.qAmtIdrEquiv || 0,
    projectPOAmt: m.projectExecutedOnlyAmt || 0,
    projectPO: m.projectExecutedOnlyCount || 0,
    sparepartExecutedQAmt: m.sparepart?.executedQAmtIdrEquiv || 0,
    serviceExecutedQAmt: m.service?.executedQAmtIdrEquiv || 0,
    projectExecutedQAmt: m.project?.executedQAmtIdrEquiv || 0,
    totalExecutedQAmt: m.totalExecutedQAmtIdrEquiv || 0,
  }));

  // Calculate YTD (Year-to-Date) Executed Quotation nominal
  // Sums from January up to the current month (if current year), or full year (if past year)
  const _thisYear = new Date().getFullYear();
  const _thisMonth = new Date().getMonth(); // 0-indexed
  let accumulatedExecutedQAmt = 0;
  let ytdEndMonthName = '';

  const limitMonthIdx = selectedYear === _thisYear ? _thisMonth : 11;
  for (let i = 0; i <= limitMonthIdx; i++) {
    const monthData = processedData[i];
    if (!monthData) break;
    if (viewMode === 'all') accumulatedExecutedQAmt += monthData.totalExecutedQAmt || 0;
    else if (viewMode === 'sparepart') accumulatedExecutedQAmt += monthData.sparepartExecutedQAmt || 0;
    else if (viewMode === 'service') accumulatedExecutedQAmt += monthData.serviceExecutedQAmt || 0;
    else if (viewMode === 'project') accumulatedExecutedQAmt += monthData.projectExecutedQAmt || 0;
    ytdEndMonthName = PIPELINE_MONTH_NAMES[i];
  }

  const tabs = [
    { id: 'all', label: 'All Categories', color: 'bg-gray-100 text-gray-600' },
    { id: 'sparepart', label: 'Sparepart', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { id: 'service', label: 'Service', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'project', label: 'Project', color: 'bg-purple-50 text-purple-600 border-purple-100' },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-bold text-gray-900">Pipeline Overview</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {viewMode === 'all' ? 'Combined performance across all divisions' : `Workflow tracking for ${viewMode} category`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {availableYears.length > 1 && (
            <select
              value={selectedYear}
              onChange={e => onYearChange(Number(e.target.value))}
              className="text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-50 rounded-xl mb-6 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${viewMode === tab.id
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6">
        {viewMode === 'all' ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-[3px] rounded-full" style={{ backgroundColor: "#3b82f6" }} />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Total Quotation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-[3px] rounded-full" style={{ backgroundColor: "#6ee7b7" }} />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Total Executed Quotation</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-[3px] rounded-full" style={{ backgroundColor: FLOW_COLORS[viewMode].quotation }} />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Quotation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-[3px] rounded-full" style={{ backgroundColor: FLOW_COLORS[viewMode].po }} />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Executed Quotation</span>
            </div>
          </>
        )}
      </div>

      {pipelineLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse w-full h-full bg-gray-50 rounded-lg" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v) => fmt(v, 'IDR')} />
            <Tooltip content={<CustomPipelineTooltip fmt={fmt} />} cursor={{ fill: '#f9fafb' }} />

            {/* Dynamic Category Target Nominal Line */}
            {(() => {
              let currentTargetVal = 0;
              let currentTargetLabel = 'Target';

              if (target) {
                if (viewMode === 'all') {
                  currentTargetVal = Number(target.target || 0);
                  currentTargetLabel = 'Total Target';
                } else if (viewMode === 'sparepart') {
                  currentTargetVal = Number(target.targetSparepart || 0);
                  currentTargetLabel = 'Target Sparepart';
                } else if (viewMode === 'service') {
                  currentTargetVal = Number(target.targetService || 0);
                  currentTargetLabel = 'Target Service';
                } else if (viewMode === 'project') {
                  currentTargetVal = Number(target.targetProject || 0);
                  currentTargetLabel = 'Target Project';
                }
              }

              if (currentTargetVal > 0) {
                return (
                  <ReferenceLine
                    y={currentTargetVal}
                    ifOverflow="extendDomain"
                    stroke="#6366f1"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    label={{
                      value: `${currentTargetLabel}: ${fmt(currentTargetVal, 'IDR')}`,
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: '#6366f1',
                      fontWeight: 700
                    }}
                  />
                );
              }
              return null;
            })()}

            {/* YTD Executed Quotation Reference Line */}
            {accumulatedExecutedQAmt > 0 && (
              <ReferenceLine y={accumulatedExecutedQAmt} ifOverflow="extendDomain" stroke="#22C55E" strokeDasharray="4 4" strokeWidth={2}
                label={{ value: `YTD Executed (Jan-${ytdEndMonthName}): ${fmt(accumulatedExecutedQAmt, 'IDR')}`, position: 'insideTopLeft', fontSize: 10, fill: '#22C55E', fontWeight: 700 }} />
            )}

            {viewMode === 'all' && (
              <>
                <Bar dataKey="totalQuotation" name="Total Quotation" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="totalPO" name="Total Executed Quotation" fill="#6ee7b7" radius={[4, 4, 0, 0]} barSize={20} />
              </>
            )}

            {viewMode === 'sparepart' && (
              <>
                <Bar dataKey="sparepartQuotationAmt" name="Quotation" fill={FLOW_COLORS.sparepart.quotation} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="sparepartPOAmt" name="Executed Quotation" fill={FLOW_COLORS.sparepart.po} radius={[4, 4, 0, 0]} barSize={20} />
              </>
            )}

            {viewMode === 'service' && (
              <>
                <Bar dataKey="serviceQuotationAmt" name="Quotation" fill={FLOW_COLORS.service.quotation} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="servicePOAmt" name="Executed Quotation" fill={FLOW_COLORS.service.po} radius={[4, 4, 0, 0]} barSize={20} />
              </>
            )}

            {viewMode === 'project' && (
              <>
                <Bar dataKey="projectQuotationAmt" name="Quotation" fill={FLOW_COLORS.project.quotation} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="projectPOAmt" name="Executed Quotation" fill={FLOW_COLORS.project.po} radius={[4, 4, 0, 0]} barSize={20} />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
// ─── Role-based Quick Actions config ─────────────────────────────────────────
const ALL_QUICK_ACTIONS = [
  { key: 'order_spare', label: 'Sparepart', to: '/inquiries', icon: ShoppingCartOutlined, color: 'emerald', roles: ['ADMIN', 'SPARE_PART'] },
  { key: 'new_service', label: 'Service', to: '/service/inquiries', icon: ToolOutlined, color: 'blue', roles: ['ADMIN', 'SERVICE'] },
  { key: 'new_project', label: 'Project', to: '/project/inquiries', icon: ProjectOutlined, color: 'purple', roles: ['ADMIN', 'PROJECT'] },
  { key: 'deliveries', label: 'Deliveries', to: '/deliveries', icon: CarOutlined, color: 'sky', roles: ['ADMIN', 'LOGISTIC'] },
  { key: 'svc_execution', label: 'Service Execution', to: '/service/executions', icon: SettingOutlined, color: 'amber', roles: ['ADMIN', 'SERVICE'] },
  { key: 'po_spare', label: 'PO Spare Part', to: '/po', icon: InboxOutlined, color: 'emerald', roles: ['PROCUREMENT'] },
  { key: 'po_service', label: 'PO Service', to: '/service/po', icon: FileTextOutlined, color: 'blue', roles: ['ADMIN', 'SERVICE'] },
  { key: 'ready_invoice', label: 'Ready to Invoice', to: '/finance/ready', icon: CheckCircleOutlined, color: 'amber', roles: ['FINANCE'] },
  { key: 'invoice_payment', label: 'Invoice & Payment', to: '/finance/invoices', icon: DollarCircleOutlined, color: 'rose', roles: ['FINANCE'] },
];

// ─── Revenue Achievement Component ────────────────────────────────────────────
const RevenueAchievementCard = ({ data, loading, fmt }) => {
  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5 h-[320px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-32 h-32 bg-gray-100 rounded-full" />
          <div className="w-32 h-4 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pieData = [
    { name: 'Sparepart', value: data.sparepartPaidIdr || 0, color: '#10b981' },
    { name: 'Service', value: data.servicePaidIdr || 0, color: '#3b82f6' },
    { name: 'Project', value: data.projectPaidIdr || 0, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  const totalAchievementPct = data.targetTotal > 0
    ? Math.min(100, (data.totalPaidIdr / data.targetTotal) * 100).toFixed(1)
    : 0;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="text-base font-bold text-gray-900 mb-3">Revenue Invoiced vs Target</h2>

      <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
        {/* Donut Chart */}
        <div className="relative w-36 h-36 shrink-0">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={68}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [fmt(value, 'IDR'), name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #f3f4f6' }}
                  itemStyle={{ color: '#1f2937', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full rounded-full border-[10px] border-gray-100 flex items-center justify-center" />
          )}

          {/* Inner Label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[18px] font-black text-gray-800 leading-none">{totalAchievementPct}%</span>
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Achieved</span>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="flex-1 w-full space-y-2.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                <span className="text-xs font-semibold text-gray-700">Sparepart</span>
              </div>
              <span className="text-xs font-bold text-emerald-600">
                {data.achievementSparepart?.toFixed(1) || 0}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] pl-4">
              <span className="text-gray-500">{fmt(data.sparepartPaidIdr, 'IDR')}</span>
              <span className="text-gray-400">/ {fmt(data.targetSparepart, 'IDR')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" />
                <span className="text-xs font-semibold text-gray-700">Service</span>
              </div>
              <span className="text-xs font-bold text-blue-600">
                {data.achievementService?.toFixed(1) || 0}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] pl-4">
              <span className="text-gray-500">{fmt(data.servicePaidIdr, 'IDR')}</span>
              <span className="text-gray-400">/ {fmt(data.targetService, 'IDR')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-purple-500" />
                <span className="text-xs font-semibold text-gray-700">Project</span>
              </div>
              <span className="text-xs font-bold text-purple-600">
                {data.achievementProject?.toFixed(1) || 0}%
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] pl-4">
              <span className="text-gray-500">{fmt(data.projectPaidIdr, 'IDR')}</span>
              <span className="text-gray-400">/ {fmt(data.targetProject, 'IDR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState({
    serviceInquiries: 0, serviceExecutions: 0, serviceProcess: 0,
    projectExecutions: 0, projectProcess: 0,
    tfsList: 0, tfsProcess: 0,
    invoiceTotal: 0, invoicePaid: 0, invoicePending: 0,
    invoicePaidAmtIDR: 0, invoicePaidAmtEUR: 0, invoicePaidAmtUSD: 0,
    invoicePendingAmtIDR: 0, invoicePendingAmtEUR: 0, invoicePendingAmtUSD: 0,
    readyToInvoiceCount: 0, readyToInvoiceAmtIDR: 0, readyToInvoiceAmtEUR: 0, readyToInvoiceAmtUSD: 0,
    utilization: null
  });
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState([]);
  const [pipelineTarget, setPipelineTarget] = useState(null);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('today');
  const [availableYears, setAvailableYears] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [utilizationData, setUtilizationData] = useState(null);
  const [utilizationLoading, setUtilizationLoading] = useState(true);
  const [invoiceAchievement, setInvoiceAchievement] = useState(null);
  const [invoiceAchievementLoading, setInvoiceAchievementLoading] = useState(true);
  const [overviewData, setOverviewData] = useState({ data: [], roles: [], monthlyTargetPerRole: {} });
  const [selectedOverviewRole, setSelectedOverviewRole] = useState('all');
  const permissions = usePermissions();
  const roles = permissions.roles || [];
  const visibleActions = ALL_QUICK_ACTIONS.filter(a => roles.some(r => a.roles.includes(r)));

  useEffect(() => {
    setLoading(true);
    const params = { year: selectedYear };

    Promise.all([
      getInquiries(params).catch(() => []),
      getServices(params).catch(() => []),
      getProjects(params).catch(() => []),
      getInvoices(params).catch(() => []),
      getDeliveries(params).catch(() => []),
      getReadyToInvoiceList({ year: selectedYear }).catch(() => []),
    ]).then(([inquiries, services, projects, invoices, deliveries, readyToInvoice]) => {
      const svcInq = Array.isArray(inquiries) ? inquiries.filter(i => i.requestType?.startsWith('SERVICE_')) : [];
      const paid = Array.isArray(invoices) ? invoices.filter(i => i.status === 'PAID') : [];
      const pending = Array.isArray(invoices) ? invoices.filter(i => i.status !== 'PAID') : [];
      const svcArr = Array.isArray(services) ? services : [];
      const prjArr = Array.isArray(projects) ? projects : [];
      const dlvArr = Array.isArray(deliveries) ? deliveries : [];
      const readyArr = Array.isArray(readyToInvoice) ? readyToInvoice : [];

      // Calculate Ready to Invoice potential amount by currency
      const readyAmtIDR = readyArr.filter(i => i.currency === 'IDR').reduce((sum, item) => {
        if (item.sourceType === 'PROJECT') return sum + (item.remainingToInvoice || 0);
        return sum + (item.items?.reduce((s, i) => s + (i.total || 0), 0) || 0);
      }, 0);
      const readyAmtEUR = readyArr.filter(i => i.currency === 'EUR').reduce((sum, item) => {
        if (item.sourceType === 'PROJECT') return sum + (item.remainingToInvoice || 0);
        return sum + (item.items?.reduce((s, i) => s + (i.total || 0), 0) || 0);
      }, 0);
      const readyAmtUSD = readyArr.filter(i => i.currency === 'USD').reduce((sum, item) => {
        if (item.sourceType === 'PROJECT') return sum + (item.remainingToInvoice || 0);
        return sum + (item.items?.reduce((s, i) => s + (i.total || 0), 0) || 0);
      }, 0);

      setData({
        serviceInquiries: svcInq.length,
        serviceExecutions: svcArr.length,
        serviceProcess: svcArr.filter(s => s.status === 'IN_PROGRESS' || s.status === 'PENDING').length,
        serviceDone: svcArr.filter(s => s.status === 'DONE' || s.status === 'COMPLETED').length,
        projectExecutions: prjArr.length,
        projectProcess: prjArr.filter(p => p.status === 'IN_PROGRESS' || p.status === 'PENDING').length,
        projectDone: prjArr.filter(p => p.status === 'DONE' || p.status === 'COMPLETED').length,
        deliveryProcess: dlvArr.filter(d => d.status !== 'COMPLETED' && d.status !== 'CANCELLED' && d.status !== 'DELIVERED').length,
        deliveryDone: dlvArr.filter(d => d.status === 'COMPLETED' || d.status === 'DELIVERED').length,
        readyToInvoiceCount: readyArr.length,
        readyToInvoiceAmtIDR: readyAmtIDR,
        readyToInvoiceAmtEUR: readyAmtEUR,
        readyToInvoiceAmtUSD: readyAmtUSD,
        invoiceTotal: Array.isArray(invoices) ? invoices.length : 0,
        invoicePaid: paid.length,
        invoicePending: pending.length,
        // Separate totals by currency
        invoicePaidAmtIDR: paid.filter(i => i.currency === 'IDR').reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0),
        invoicePaidAmtEUR: paid.filter(i => i.currency === 'EUR').reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0),
        invoicePaidAmtUSD: paid.filter(i => i.currency === 'USD').reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0),
        invoicePendingAmtIDR: pending.filter(i => i.currency === 'IDR').reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0),
        invoicePendingAmtEUR: pending.filter(i => i.currency === 'EUR').reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0),
        invoicePendingAmtUSD: pending.filter(i => i.currency === 'USD').reduce((s, i) => s + parseFloat(i.totalAmount || 0), 0)
      });
    }).finally(() => setLoading(false));
  }, [selectedYear]);

  // Resource Utilization stats - refetch when month or year changes
  useEffect(() => {
    setUtilizationLoading(true);
    api.get(`/dashboard/resource-utilization?month=${selectedMonth}&year=${selectedYear}`)
      .then(r => setUtilizationData(r.data))
      .catch(() => setUtilizationData(null))
      .finally(() => setUtilizationLoading(false));
  }, [selectedMonth, selectedYear]);

  // Pipeline stats — re-fetch when year changes
  useEffect(() => {
    setPipelineLoading(true);
    api.get(`/dashboard/pipeline-stats?year=${selectedYear}`)
      .then(r => {
        setPipeline(r.data.months || []);
        setAvailableYears(r.data.availableYears || [selectedYear]);
        setPipelineTarget(r.data.target || null);
      })
      .catch(() => setPipeline([]))
      .finally(() => setPipelineLoading(false));

    // Fetch Overview Data
    api.get(`/dashboard/resource-overview?year=${selectedYear}`)
      .then(r => setOverviewData(r.data || { data: [], roles: [], monthlyTargetPerRole: {} }))
      .catch(console.error);

    // Fetch Invoice Achievement Data
    setInvoiceAchievementLoading(true);
    api.get(`/dashboard/invoice-achievement?year=${selectedYear}`)
      .then(r => setInvoiceAchievement(r.data))
      .catch(console.error)
      .finally(() => setInvoiceAchievementLoading(false));
  }, [selectedYear]);

  const handleDownloadReport = async () => {
    try {
      setReportLoading(true);
      const response = await api.get(`/dashboard/export-csv?year=${selectedYear}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `LIND_Report_${selectedYear}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download report:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const fmt = (n, cur = 'IDR') => {
    if (n === null || n === undefined) return cur === 'IDR' ? 'Rp0' : cur === 'EUR' ? '€0' : '$0';
    const symbol = cur === 'IDR' ? 'Rp' : cur === 'EUR' ? '€' : '$';
    if (n >= 1_000_000_000) return `${symbol}${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${symbol}${(n / 1_000).toFixed(1)}K`;
    return `${symbol}${n.toLocaleString('id-ID')}`;
  };

  const svcPct = data.serviceExecutions ? Math.round((data.serviceProcess / data.serviceExecutions) * 100) : 0;
  const prjPct = data.projectExecutions ? Math.round((data.projectProcess / data.projectExecutions) * 100) : 0;
  const finPct = data.invoiceTotal ? Math.round((data.invoicePaid / data.invoiceTotal) * 100) : 0;
  const svcDone = data.serviceDone || 0;
  const prjDone = data.projectDone || 0;

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto pb-10">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Overview</h1>
          <p className="text-sm text-gray-400">Real-time operational and financial performance indicators.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedYear}
            onChange={(val) => setSelectedYear(val)}
            className="w-28 font-semibold"
            options={availableYears.map(y => ({ value: y, label: String(y) }))}
          />
          <button
            onClick={handleDownloadReport}
            disabled={reportLoading}
            className={`flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors ${reportLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <DownloadOutlined style={{ fontSize: 14 }} className={reportLoading ? 'animate-bounce' : ''} />
            {reportLoading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* ── BARIS 1: Stat Cards (KPI Overview) ─────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Active Projects"
          value={loading ? '—' : String(data.projectProcess || 0).padStart(2, '0')}
          sub={`+${prjDone} completed`}
          subColor="text-emerald-600"
          icon={AppstoreOutlined}
          iconColor="text-emerald-600"
          loading={loading}
        />
        <StatCard
          title="Active Services"
          value={loading ? '—' : String(data.serviceProcess || 0).padStart(2, '0')}
          sub={`+${svcDone} completed`}
          subColor="text-blue-600"
          icon={ThunderboltOutlined}
          iconColor="text-blue-600"
          loading={loading}
        />
        <StatCard
          title="Active Delivery"
          value={loading ? '—' : String(data.deliveryProcess || 0).padStart(2, '0')}
          sub={`+${data.deliveryDone || 0} completed`}
          subColor="text-amber-600"
          icon={CarOutlined}
          iconColor="text-amber-600"
          loading={loading}
        />
        <StatCard
          title="Ready to Invoice"
          value={loading ? '—' : String(data.readyToInvoiceCount || 0).padStart(2, '0')}
          sub={`${fmt(data.readyToInvoiceAmtIDR || 0, 'IDR')} | ${fmt(data.readyToInvoiceAmtEUR || 0, 'EUR')} | ${fmt(data.readyToInvoiceAmtUSD || 0, 'USD')}`}
          subColor="text-purple-600"
          icon={AuditOutlined}
          iconColor="text-purple-600"
          loading={loading}
        />
      </div>

      {/* ── BARIS 2: FINANCIAL ANALYTICS ZONE (Keuangan & Target) ──────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Financial Performance &amp; Target</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Yearly Overview vs Target Chart (2/3 width) */}
          <div className="lg:col-span-2">
            <PipelineChart
              pipelineData={pipeline}
              pipelineLoading={pipelineLoading}
              selectedYear={selectedYear}
              availableYears={availableYears}
              onYearChange={setSelectedYear}
              fmt={fmt}
              target={pipelineTarget}
            />
          </div>

          {/* Right Side of Financial Analytics (1/3 width): Revenue Achievement Pie + Finance Highlights */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <RevenueAchievementCard
              data={invoiceAchievement}
              loading={invoiceAchievementLoading}
              fmt={fmt}
            />

            {/* Finance Highlights */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Finance Highlights</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="text-[10px] font-bold uppercase tracking-tight text-emerald-600 mb-1.5">Paid Amount</p>
                  <div className="flex justify-between items-baseline border-b border-emerald-100/50 pb-1 text-xs">
                    <span className="font-semibold text-emerald-700/70">IDR</span>
                    <span className="font-bold text-emerald-900">{loading ? '—' : fmt(data.invoicePaidAmtIDR, 'IDR')}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-emerald-100/50 pb-1 pt-1 text-xs">
                    <span className="font-semibold text-emerald-700/70">EUR</span>
                    <span className="font-bold text-emerald-900">{loading ? '—' : fmt(data.invoicePaidAmtEUR, 'EUR')}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 text-xs">
                    <span className="font-semibold text-emerald-700/70">USD</span>
                    <span className="font-bold text-emerald-900">{loading ? '—' : fmt(data.invoicePaidAmtUSD, 'USD')}</span>
                  </div>
                </div>

                <div className="bg-rose-50 p-3 rounded-lg border border-rose-100">
                  <p className="text-[10px] font-bold uppercase tracking-tight text-rose-600 mb-1.5">Unpaid Amount</p>
                  <div className="flex justify-between items-baseline border-b border-rose-100/50 pb-1 text-xs">
                    <span className="font-semibold text-rose-700/70">IDR</span>
                    <span className="font-bold text-rose-600">{loading ? '—' : fmt(data.invoicePendingAmtIDR, 'IDR')}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-rose-100/50 pb-1 pt-1 text-xs">
                    <span className="font-semibold text-rose-700/70">EUR</span>
                    <span className="font-bold text-rose-600">{loading ? '—' : fmt(data.invoicePendingAmtEUR, 'EUR')}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 text-xs">
                    <span className="font-semibold text-rose-700/70">USD</span>
                    <span className="font-bold text-rose-600">{loading ? '—' : fmt(data.invoicePendingAmtUSD, 'USD')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARIS 3: OPERATIONAL & PIPELINE ZONE ───────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Operations &amp; Resource Tracking</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          
          {/* Left Column: Service & Project Summary + Quick Actions */}
          <div className="flex flex-col gap-4">
            {/* Service & Project Summary */}
            <div className="bg-white border border-gray-100 rounded-xl p-6 flex-1">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-900">Service &amp; Project Summary</h3>
              </div>
              <ProgressRow label="Service Execution — In Progress" pct={svcPct} loading={loading} />
              <ProgressRow label="Project Execution — In Progress" pct={prjPct} loading={loading} />
              <ProgressRow label="Invoice Collection Rate" pct={finPct} loading={loading} />
              <ProgressRow
                label="Service Completion Rate"
                pct={data.serviceExecutions ? Math.round((svcDone / data.serviceExecutions) * 100) : 0}
                loading={loading}
              />
              <ProgressRow
                label="Project Completion Rate"
                pct={data.projectExecutions ? Math.round((prjDone / data.projectExecutions) * 100) : 0}
                loading={loading}
              />
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Quick Actions
                </p>

                {roles.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {roles.map((role) => (
                      <span
                        key={role}
                        className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {visibleActions.length > 0 ? (
                <div className={`grid gap-3 ${visibleActions.length === 1 ? 'grid-cols-1 max-w-[180px] mx-auto w-full' :
                  visibleActions.length === 2 ? 'grid-cols-2' :
                    visibleActions.length === 3 ? 'grid-cols-3' :
                      visibleActions.length === 4 ? 'grid-cols-4' :
                        visibleActions.length === 5 ? 'grid-cols-5' :
                          'grid-cols-3 sm:grid-cols-3'
                  }`}>
                  {visibleActions.map(action => (
                    <QuickBtn
                      key={action.key}
                      label={action.label}
                      to={action.to}
                      icon={action.icon}
                      colorClass={action.color}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-gray-400">
                  No quick actions available for your role.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Resource Utilization */}
          <div className="h-full">
            <ResourceUtilizationCard
              stats={utilizationData}
              loading={utilizationLoading}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              overviewData={overviewData}
              selectedOverviewRole={selectedOverviewRole}
              onOverviewRoleChange={setSelectedOverviewRole}
            />
          </div>
        </div>
      </div>

      {/* ── BARIS 4: SYSTEM ALERTS ────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="text-base font-bold text-gray-900 mb-3">Recent Alerts</h2>
        <div>
          {data.invoicePending > 0 && (
            <AlertItem
              icon={WarningOutlined}
              iconColor="text-amber-500"
              iconBg="bg-amber-50"
              title={`${data.invoicePending} unpaid invoice(s) pending`}
              subtitle="Finance review required"
            />
          )}
          {data.serviceProcess > 0 && (
            <AlertItem
              icon={CheckCircleOutlined}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
              title={`${data.serviceProcess} service execution(s) active`}
              subtitle="Ongoing — updated now"
            />
          )}
          {data.projectProcess > 0 && (
            <AlertItem
              icon={InfoCircleOutlined}
              iconColor="text-blue-500"
              iconBg="bg-blue-50"
              title={`${data.projectProcess} project(s) in progress`}
              subtitle="Monitor progress regularly"
            />
          )}
          {!loading && data.invoicePending === 0 && data.serviceProcess === 0 && data.projectProcess === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">
              <CheckCircleOutlined className="text-emerald-400 text-xl mb-2 block" />
              No active alerts
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
