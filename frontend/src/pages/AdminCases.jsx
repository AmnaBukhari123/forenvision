// AdminCases.jsx
import React, { useState, useEffect } from "react";
import { 
  FolderOpen, 
  Search, 
  Filter,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { getAdminCases, getInvestigators } from "../services/api";
import "./AdminCases.css";

export default function AdminCases() {
  const [cases, setCases] = useState([]);
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterInvestigator, setFilterInvestigator] = useState("all");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    loadCases();
    loadInvestigators();
  }, [filterStatus, filterInvestigator]);

  const loadCases = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterInvestigator !== "all") params.investigator_id = filterInvestigator;

      const response = await getAdminCases(params);
      const data = await response.json();
      setCases(data.cases || []);
    } catch (error) {
      console.error("Failed to load cases:", error);
      setMessage({ type: "error", text: "Failed to load cases" });
    } finally {
      setLoading(false);
    }
  };

  const loadInvestigators = async () => {
    try {
      const response = await getInvestigators();
      const data = await response.json();
      setInvestigators(data.investigators || []);
    } catch (error) {
      console.error("Failed to load investigators:", error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      "New": { color: "info", icon: AlertCircle },
      "Active": { color: "success", icon: CheckCircle },
      "In Progress": { color: "warning", icon: Clock },
      "Pending": { color: "warning", icon: Clock },
      "Closed": { color: "neutral", icon: XCircle },
      "Archived": { color: "neutral", icon: XCircle }
    };

    const badge = badges[status] || badges["New"];
    const Icon = badge.icon;

    return (
      <span className={`status-badge ${badge.color}`}>
        <Icon size={14} />
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: "success",
      medium: "warning",
      high: "danger",
      urgent: "danger-pulse"
    };

    return (
      <span className={`priority-badge ${colors[priority?.toLowerCase()] || colors.medium}`}>
        {priority || "medium"}
      </span>
    );
  };

  const filteredCases = cases.filter(caseItem => {
    const q = searchQuery.toLowerCase();
    return (
      caseItem.name.toLowerCase().includes(q) ||
      (caseItem.client && caseItem.client.toLowerCase().includes(q)) ||
      (caseItem.category && caseItem.category.toLowerCase().includes(q))
    );
  });

  const caseStats = {
    total: filteredCases.length,
    active: filteredCases.filter(c => c.status === "Active" || c.status === "In Progress").length,
    pending: filteredCases.filter(c => c.status === "Pending" || c.status === "New").length,
    closed: filteredCases.filter(c => c.status === "Closed").length
  };

  return (
    <div className="admin-cases">
      <div className="page-header">
        <div>
          <h1 className="page-title">All Cases</h1>
          <p className="page-subtitle">Monitor and manage all forensic investigation cases</p>
        </div>
      </div>

      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: "", text: "" })}>×</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="search-filter-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by case name, client, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={18} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="Active">Active</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending">Pending</option>
            <option value="Closed">Closed</option>
          </select>

          <select value={filterInvestigator} onChange={(e) => setFilterInvestigator(e.target.value)}>
            <option value="all">All Investigators</option>
            {investigators.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cases Table */}
      {loading ? (
        <div className="loading-state">Loading cases...</div>
      ) : filteredCases.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={48} />
          <h3>No Cases Found</h3>
          <p>No cases match your search criteria.</p>
        </div>
      ) : (
        <div className="cases-table-container">
          <table className="cases-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Case Name</th>
                <th>Client</th>
                <th>Category</th>
                <th>Investigator</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
              </tr>
            </thead>

            <tbody>
              {filteredCases.map((caseItem) => (
                <tr key={caseItem.id}>
                  <td className="id-cell">#{caseItem.id}</td>

                  <td className="case-name-cell">
                    <div className="case-name">
                      <FolderOpen size={16} />
                      <span>{caseItem.name}</span>
                    </div>
                  </td>

                  <td>{caseItem.client || "-"}</td>

                  <td>
                    <span className="category-badge">
                      {caseItem.category || "General"}
                    </span>
                  </td>

                  <td>
                    <div className="investigator-cell">
                      <User size={14} />
                      <span>{caseItem.investigator_name || "Unassigned"}</span>
                    </div>
                  </td>

                  <td>{getPriorityBadge(caseItem.priority)}</td>
                  <td>{getStatusBadge(caseItem.status)}</td>

                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {new Date(caseItem.created_at).toLocaleDateString()}
                    </div>
                  </td>

                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {new Date(caseItem.updated_at).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>
  );
}
