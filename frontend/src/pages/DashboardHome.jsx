// pages/DashboardHome.jsx - FINAL VERSION
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  TrendingUp, AlertCircle, Clock, CheckCircle, Calendar, User, 
  CheckSquare, XSquare, ChevronDown
} from "lucide-react";
import { listCases, acceptCase, updateInvestigatorAvailability, getCurrentUser } from "../services/api";
import "./DashboardHome.css";

export default function DashboardHome() {
  const [summary, setSummary] = useState({ 
    total: 0, 
    active: 0, 
    pending: 0, 
    completed: 0,
    pendingAcceptance: 0
  });
  const [recentCases, setRecentCases] = useState([]);
  const [pendingAcceptanceCases, setPendingAcceptanceCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingCase, setProcessingCase] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [availability, setAvailability] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadCases();
    loadUserAvailability();
  }, []);

  const loadUserAvailability = async () => {
    try {
      const user = getCurrentUser();
      if (user) {
        setAvailability(user.is_available !== false);
      }
    } catch (error) {
      console.error('Error loading user availability:', error);
    }
  };

  const handleAvailabilityChange = async (newStatus) => {
    try {
      const response = await updateInvestigatorAvailability(newStatus);
      
      if (response.ok) {
        setAvailability(newStatus);
        setShowDropdown(false);
        setMessage({ 
          type: "success", 
          text: `Status updated to ${newStatus ? 'Available' : 'Unavailable'}` 
        });
        
        // Update user in localStorage
        const user = getCurrentUser();
        if (user) {
          user.is_available = newStatus;
          localStorage.setItem('user', JSON.stringify(user));
        }
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage({ type: "", text: "" }), 3000);
      } else {
        throw new Error("Failed to update availability");
      }
    } catch (err) {
      console.error(err);
      setMessage({ 
        type: "error", 
        text: "Failed to update availability status" 
      });
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const res = await listCases();
      console.log('Load cases response:', res);
      
      if (res.ok) {
        const data = await res.json();
        console.log('Cases data:', data);
        const cases = data.cases || [];
        console.log('Total cases received:', cases.length);
        console.log('Full cases data:', cases);
        
        // Cases pending acceptance (waiting for investigator to accept/decline)
        const pendingAcceptanceCasesList = cases.filter(c => {
          const isPending =
            c.acceptance_status === "pending" ||
            (c.status && c.status.toLowerCase() === "assigned");

          console.log(
            `Case ${c.id} - acceptance_status: ${c.acceptance_status}, status: ${c.status}, isPending: ${isPending}`
          );

          return isPending;
        });

        console.log('Pending acceptance cases:', pendingAcceptanceCasesList.length, pendingAcceptanceCasesList);
        
        // Count active cases (accepted and in progress, excluding pending acceptance)
        const active = cases.filter(c => {
          const status = c.status?.toLowerCase();
          const isAccepted = c.acceptance_status === 'accepted' || !c.acceptance_status;
          return (status === "active" || status === "new" || status === "in progress" || status === "assigned") 
                 && isAccepted;
        }).length;
        
        // Pending status cases (not pending acceptance, but pending work)
        const pending = cases.filter(c => 
          c.status && c.status.toLowerCase() === "pending" && c.acceptance_status !== 'pending'
        ).length;
        
        const completed = cases.filter(c => {
          const status = c.status?.toLowerCase();
          return status === "completed" || status === "closed";
        }).length;
        
        const total = cases.filter(c => c.acceptance_status !== 'pending').length;
        
        console.log('Summary stats:', { 
          total, 
          active, 
          pending, 
          completed, 
          pendingAcceptance: pendingAcceptanceCasesList.length 
        });
        
        setSummary({ 
          total, 
          active, 
          pending, 
          completed,
          pendingAcceptance: pendingAcceptanceCasesList.length
        });
        
        setPendingAcceptanceCases(pendingAcceptanceCasesList);
        
        // Get 5 most recent cases (excluding pending acceptance)
        const acceptedCases = cases.filter(c => 
          c.acceptance_status === 'accepted' || 
          c.acceptance_status === 'declined' || 
          !c.acceptance_status
        );
        const sortedCases = [...acceptedCases].sort((a, b) => 
          new Date(b.updated_at) - new Date(a.updated_at)
        );
        setRecentCases(sortedCases.slice(0, 5));
      } else {
        const errorData = await res.json();
        console.error('Failed to load cases:', errorData);
        setMessage({ type: "error", text: "Failed to load cases" });
      }
    } catch (error) {
      console.error('Error loading cases:', error);
      setMessage({ type: "error", text: "Error loading cases" });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptCase = async (caseId) => {
    setProcessingCase(caseId);
    setMessage({ type: "", text: "" });
    try {
      const response = await acceptCase(caseId, { acceptance_status: 'accepted' });
      if (response.ok) {
        setMessage({ type: "success", text: "Case accepted successfully! You can now view it in your cases." });
        await loadCases();
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.detail || "Failed to accept case" });
      }
    } catch (error) {
      console.error('Error accepting case:', error);
      setMessage({ type: "error", text: "Error accepting case" });
    } finally {
      setProcessingCase(null);
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

  const handleDeclineCase = async (caseId, reason) => {
    setProcessingCase(caseId);
    setMessage({ type: "", text: "" });
    try {
      const response = await acceptCase(caseId, { 
        acceptance_status: 'declined',
        rejection_reason: reason || 'No reason provided'
      });
      if (response.ok) {
        setMessage({ type: "success", text: "Case declined successfully" });
        await loadCases();
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.detail || "Failed to decline case" });
      }
    } catch (error) {
      console.error('Error declining case:', error);
      setMessage({ type: "error", text: "Error declining case" });
    } finally {
      setProcessingCase(null);
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

  const getStatusBadge = (status) => {
    const statusClass = status?.toLowerCase() || 'new';
    return <span className={`status-badge ${statusClass}`}>{status || 'New'}</span>;
  };

  const getPriorityBadge = (priority) => {
    if (!priority) return null;
    const priorityClass = priority.toLowerCase();
    return <span className={`priority-badge ${priorityClass}`}>{priority}</span>;
  };

  return (
    <div className="dashboard-home">
      {/* Message Banner */}
      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: "", text: "" })}>×</button>
        </div>
      )}

      {/* Dashboard Header with Availability Dropdown */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">Welcome to ForenVision</h1>
          
        </div>
        
        {/* Availability Dropdown */}
        <div className="availability-dropdown-container">
          <button 
            className={`availability-button ${availability ? 'available' : 'unavailable'}`}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span className="status-indicator"></span>
            <span>{availability ? 'Available' : 'Unavailable'}</span>
            <ChevronDown size={16} />
          </button>
          
          {showDropdown && (
            <>
              <div className="dropdown-overlay" onClick={() => setShowDropdown(false)}></div>
              <div className="availability-dropdown-menu">
                <button 
                  className={`dropdown-item ${availability ? 'active' : ''}`}
                  onClick={() => handleAvailabilityChange(true)}
                >
                  <span className="status-indicator available"></span>
                  Available
                  {availability && <CheckCircle size={16} />}
                </button>
                <button 
                  className={`dropdown-item ${!availability ? 'active' : ''}`}
                  onClick={() => handleAvailabilityChange(false)}
                >
                  <span className="status-indicator unavailable"></span>
                  Unavailable
                  {!availability && <CheckCircle size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pending Acceptance Cases Alert */}
      {pendingAcceptanceCases.length > 0 && (
        <div className="pending-acceptance-alert">
          <div className="alert-header">
            <AlertCircle size={24} />
            <h3>New Case Assignments</h3>
          </div>
          <p>You have {pendingAcceptanceCases.length} case(s) waiting for your acceptance</p>
          
          <div className="pending-cases-list">
            {pendingAcceptanceCases.map(c => (
              <div key={c.id} className="pending-case-card">
                <div className="pending-case-info">
                  <div className="pending-case-header">
                    <span className="case-id">#{c.id}</span>
                    <h4>{c.name}</h4>
                  </div>
                  <div className="pending-case-details">
                    {getPriorityBadge(c.priority)}
                    <span className="case-category">{c.category || 'General Investigation'}</span>
                    {c.client && <span className="case-client">Client: {c.client}</span>}
                  </div>
                  {c.description && (
                    <p className="case-description">
                      {c.description.length > 150 
                        ? `${c.description.substring(0, 150)}...` 
                        : c.description}
                    </p>
                  )}
                </div>
                <div className="pending-case-actions">
                  <button
                    className="btn-accept"
                    onClick={() => handleAcceptCase(c.id)}
                    disabled={processingCase === c.id}
                  >
                    <CheckSquare size={18} />
                    {processingCase === c.id ? 'Processing...' : 'Accept Case'}
                  </button>
                  <button
                    className="btn-decline"
                    onClick={() => {
                      const reason = prompt('Please provide a reason for declining this case (optional):');
                      if (reason !== null) handleDeclineCase(c.id, reason);
                    }}
                    disabled={processingCase === c.id}
                  >
                    <XSquare size={18} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="summary-cards">
        <div className="summary-card total-card">
          <div className="card-icon">
            <TrendingUp size={28} />
          </div>
          <div className="card-content">
            <div className="summary-label">Total Cases</div>
            <div className="summary-value">{summary.total}</div>
          </div>
        </div>

        <div className="summary-card active-card">
          <div className="card-icon">
            <AlertCircle size={28} />
          </div>
          <div className="card-content">
            <div className="summary-label">Active Cases</div>
            <div className="summary-value">{summary.active}</div>
          </div>
        </div>

        <div className="summary-card pending-card">
          <div className="card-icon">
            <Clock size={28} />
          </div>
          <div className="card-content">
            <div className="summary-label">Pending Acceptance</div>
            <div className="summary-value">{summary.pendingAcceptance}</div>
          </div>
        </div>

        <div className="summary-card completed-card">
          <div className="card-icon">
            <CheckCircle size={28} />
          </div>
          <div className="card-content">
            <div className="summary-label">Completed</div>
            <div className="summary-value">{summary.completed}</div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="recent-activity-section">
        <div className="section-header">
          <h2>Recent Cases</h2>
          <Link to="/dashboard/cases" className="view-all-link">
            View All Cases →
          </Link>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading cases...</p>
          </div>
        ) : recentCases.length > 0 ? (
          <div className="recent-cases-list">
            {recentCases.map(c => (
              <Link 
                key={c.id} 
                to={`/dashboard/cases/${c.id}`} 
                className="case-item"
              >
                <div className="case-item-header">
                  <div className="case-left">
                    <span className="case-id">#{c.id}</span>
                    <h3 className="case-name">{c.name}</h3>
                  </div>
                  <div className="case-right">
                    {getPriorityBadge(c.priority)}
                    {getStatusBadge(c.status)}
                  </div>
                </div>
                
                <div className="case-item-details">
                  <div className="detail-item">
                    <User size={16} />
                    <span>{c.investigating_officer || "Unassigned"}</span>
                  </div>
                  <div className="detail-item">
                    <Calendar size={16} />
                    <span>Updated {new Date(c.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <p className="empty-title">No Cases Found</p>
            <p className="empty-description">
              {summary.pendingAcceptance > 0 
                ? "Accept a case assignment above to get started" 
                : "You don't have any active cases yet"}
            </p>
            {summary.pendingAcceptance === 0 && (
              <Link to="/dashboard/cases/create" className="empty-action-btn">
                Create Your First Case
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Quick Links Section */}
      <div className="quick-links-section">
        <h3>Quick Actions</h3>
        <div className="quick-links-grid">
          <Link to="/dashboard/cases" className="quick-link-card">
            <div className="quick-link-icon">📋</div>
            <div className="quick-link-text">
              <h4>Manage Cases</h4>
              <p>View and organize all cases</p>
            </div>
          </Link>

          <Link to="/dashboard/cases/create" className="quick-link-card">
            <div className="quick-link-icon">➕</div>
            <div className="quick-link-text">
              <h4>Create Case</h4>
              <p>Start a new investigation</p>
            </div>
          </Link>

          <Link to="/dashboard/settings" className="quick-link-card">
            <div className="quick-link-icon">⚙️</div>
            <div className="quick-link-text">
              <h4>Settings</h4>
              <p>Configure your preferences</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Info Footer */}
      <div className="dashboard-footer">
        <p>💡 Quick Tip: Navigate to <Link to="/dashboard/cases">Cases</Link> to view and manage all your forensic investigations.</p>
      </div>
    </div>
  );
}