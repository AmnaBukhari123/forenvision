// pages/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { 
  FolderOpen, 
  Mail, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  UserCheck,
  Activity,
  ArrowRight
} from "lucide-react";
import { getAdminDashboardStats } from "../services/api";
import "./AdminDashboard.css";

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
    return (
      <div className="loading-spinner">Loading dashboard...</div>
    );
  }

  if (error) {
    return (
      <div className="error-message">{error}</div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Admin Dashboard</h1>
        <p className="dashboard-subtitle">System Overview and Management</p>
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
            {stats?.pending_requests > 0 && (
              <span className="action-badge">{stats.pending_requests}</span>
            )}
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
        </div>
      </div>
    </div>
  );
}