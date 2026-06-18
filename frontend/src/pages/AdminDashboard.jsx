import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  Mail,
  TrendingUp,
  CheckCircle,
  Clock,
  UserCheck,
  Activity,
  ArrowRight,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { getAdminDashboardStats } from "../services/api";
import "./AdminDashboard.css";

const CATEGORY_COLORS = ["#3b82f6", "#10b981", "#fbbf24", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444", "#6b7280"];
const PRIORITY_COLORS = { Low: "#10b981", Medium: "#fbbf24", High: "#f97316", Critical: "#ef4444", Unspecified: "#6b7280" };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="frr-chart-tooltip">
      {label && <div className="frr-chart-tooltip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="frr-chart-tooltip-row">
          <span className="frr-chart-tooltip-swatch" style={{ background: p.color || p.fill }} />
          <span>{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await getAdminDashboardStats();
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError("Failed to load dashboard statistics");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const categoryData = Object.entries(stats?.cases_by_category || {}).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(stats?.cases_by_priority || {}).map(([name, value]) => ({ name, value }));
  const statusData = Object.entries(stats?.cases_by_status || {}).map(([name, value]) => ({ name, value }));
  const trendData = stats?.monthly_trend || [];

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <div>
            <h1 className="dashboard-title">Admin Dashboard</h1>
            <p className="dashboard-subtitle">System Overview and Management</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card green-border">
          <div className="metric-icon green-bg">
            <FolderOpen size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{stats?.total_cases || 0}</h3>
            <p className="metric-label">Total Cases</p>
            <div className="metric-breakdown">
              <span>Active: {stats?.cases_by_status?.Active || 0}</span>
              <span>Closed: {stats?.cases_by_status?.Closed || 0}</span>
              <span>Pending: {stats?.cases_by_status?.Pending || 0}</span>
            </div>
          </div>
        </div>

        <div className="metric-card orange-border">
          <div className="metric-icon orange-bg">
            <Mail size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{stats?.total_requests || 0}</h3>
            <p className="metric-label">Contact Requests</p>
            <div className="metric-breakdown">
              <span>Pending: {stats?.requests_by_status?.pending || 0}</span>
              <span>Approved: {stats?.requests_by_status?.approved || 0}</span>
              <span>Converted: {stats?.requests_by_status?.converted || 0}</span>
            </div>
          </div>
        </div>

        <div className="metric-card purple-border">
          <div className="metric-icon purple-bg">
            <UserCheck size={24} />
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{stats?.active_investigators || 0}</h3>
            <p className="metric-label">Active Investigators</p>
            <div className="metric-breakdown">
              <span>Total: {stats?.users_by_role?.investigator || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {stats?.pending_requests > 0 && (
        <div className="alerts-section">
          <div className="alert-card warning">
            <Clock size={20} />
            <div>
              <h4>Pending Contact Requests</h4>
              <p>You have {stats.pending_requests} contact request(s) waiting for review</p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ CHARTS SECTION */}
      <div className="charts-section">
        <h2 className="section-title">
          <BarChart3 size={20} />
          Case Statistics
        </h2>

        <div className="charts-grid">
          {/* Cases by Category — Pie */}
          <div className="chart-card">
            <div className="chart-card-header">
              <PieChartIcon size={18} />
              <h4>Cases by Category</h4>
            </div>
            {categoryData.length === 0 ? (
              <div className="chart-empty">No category data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cases by Priority — Bar */}
          <div className="chart-card">
            <div className="chart-card-header">
              <BarChart3 size={18} />
              <h4>Cases by Priority</h4>
            </div>
            {priorityData.length === 0 ? (
              <div className="chart-empty">No priority data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59,130,246,0.05)" }} />
                  <Bar dataKey="value" name="Cases" radius={[6, 6, 0, 0]}>
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cases by Status — Bar */}
          <div className="chart-card">
            <div className="chart-card-header">
              <Activity size={18} />
              <h4>Cases by Status</h4>
            </div>
            {statusData.length === 0 ? (
              <div className="chart-empty">No status data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={statusData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59,130,246,0.05)" }} />
                  <Bar dataKey="value" name="Cases" fill="#60a5fa" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Monthly Trend — Area */}
          <div className="chart-card chart-card-wide">
            <div className="chart-card-header">
              <TrendingUp size={18} />
              <h4>Case Trend (Last 6 Months)</h4>
            </div>
            {trendData.length === 0 ? (
              <div className="chart-empty">No trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="count" name="New Cases" stroke="#3b82f6" strokeWidth={2} fill="url(#trendGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <h2 className="section-title">
          <Activity size={20} />
          Recent Activity
        </h2>
        <div className="activity-stats">
          <div className="activity-stat">
            <TrendingUp size={20} />
            <span>{stats?.recent_cases || 0} new cases in the last 7 days</span>
          </div>
          <div className="activity-stat">
            <CheckCircle size={20} />
            <span>{stats?.cases_by_status?.Closed || 0} cases closed</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="actions-grid">
          <a href="/dashboard/admin/contact-requests" className="action-card orange-action">
            <div className="action-icon">
              <Mail size={24} />
            </div>
            <span className="action-title">Review Contact Requests</span>
            {stats?.pending_requests > 0 && <span className="action-badge">{stats.pending_requests}</span>}
            <ArrowRight size={20} className="action-arrow" />
          </a>
          <a href="/dashboard/admin/investigators" className="action-card purple-action">
            <div className="action-icon">
              <UserCheck size={24} />
            </div>
            <span className="action-title">Manage Investigators</span>
            <ArrowRight size={20} className="action-arrow" />
          </a>
          <a href="/dashboard/admin/cases" className="action-card green-action">
            <div className="action-icon">
              <FolderOpen size={24} />
            </div>
            <span className="action-title">View All Cases</span>
            <ArrowRight size={20} className="action-arrow" />
          </a>
          <a href="/dashboard/admin/pending-investigators" className="action-card orange-action">
            <div className="action-icon">
              <UserCheck size={24} />
            </div>
            <span className="action-title">Review Investigator Requests</span>
            {stats?.pending_investigators > 0 && <span className="action-badge">{stats.pending_investigators}</span>}
            <ArrowRight size={20} className="action-arrow" />
          </a>
        </div>
      </div>
    </div>
  );
}