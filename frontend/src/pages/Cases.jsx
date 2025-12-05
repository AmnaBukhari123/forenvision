// pages/Cases.jsx - UPDATED WITH MODAL + FIXED NAME SIZE
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCases, deleteCase, getCurrentUser } from "../services/api";
import "./Cases.css";

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [tab, setTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const currentUser = getCurrentUser();

  const load = async () => {
    setLoading(true);
    const params = {};
    
    if (tab === "Active") params.status = "Active";
    else if (tab === "Pending") params.status = "Pending";
    else if (tab === "Completed") params.status = "Completed";

    if (searchQuery) params.q = searchQuery;
    
    const res = await listCases(params);
    if (res.ok) {
      const data = await res.json();
      const acceptedCases = (data.cases || []).filter(
        c => c.acceptance_status !== "pending"
      );
      setCases(acceptedCases);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tab]);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const openDeleteConfirm = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    const res = await deleteCase(deleteId);
    if (res.ok) load();
    setShowConfirm(false);
  };

  const getStatusBadge = (status) => {
    const statusClass = status?.toLowerCase() || "new";
    return (
      <span className={`status-badge ${statusClass}`}>
        {status || "New"}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    if (!priority) return "-";
    return (
      <span className={`priority-badge ${priority.toLowerCase()}`}>
        {priority}
      </span>
    );
  };

  const getAcceptanceStatusBadge = (acceptanceStatus) => {
    if (!acceptanceStatus || acceptanceStatus === "accepted") return null;

    return (
      <span className={`acceptance-badge ${acceptanceStatus}`}>
        {acceptanceStatus === "declined" ? "Declined" : "Pending Review"}
      </span>
    );
  };

  return (
    <div className="cases-container">
      <div className="cases-header">
        <h2>My Cases</h2>

        {currentUser?.role === "admin" && (
          <Link to="/dashboard/cases/create" className="create-btn">
            + Create New Case
          </Link>
        )}
      </div>

      <div className="cases-filters">
        <div className="tabs">
          {["All", "Active", "Pending", "Completed"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`tab-btn ${t === tab ? "active" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case name..."
            className="search-input"
          />
          <button type="submit" className="search-btn">Search</button>

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                load();
              }}
              className="clear-btn"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="cases-table-container">
        {loading ? (
          <div className="loading">Loading cases...</div>
        ) : (
          <table className="cases-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Analyst</th>
                <th>Priority</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td className="case-id">#{c.id}</td>

                  <td className="case-name">
                    <div className="case-name-content">
                      <span className="case-title">{c.name}</span>
                      {getAcceptanceStatusBadge(c.acceptance_status)}
                    </div>
                  </td>

                  <td>{getStatusBadge(c.status)}</td>
                  <td>{c.investigating_officer || "-"}</td>
                  <td>{getPriorityBadge(c.priority)}</td>
                  <td>{new Date(c.updated_at).toLocaleString()}</td>

                  <td className="actions">
                    <Link to={`/dashboard/cases/${c.id}`} className="open-btn">
                      Open
                    </Link>

                    <button
                      onClick={() => openDeleteConfirm(c.id)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {cases.length === 0 && (
                <tr>
                  <td colSpan={7} className="no-cases">
                    {searchQuery
                      ? "No cases match your search"
                      : "No cases found. Cases assigned to you will appear here after acceptance."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* DELETE CONFIRMATION POPUP */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this case?</p>

            <div className="modal-actions">
              <button onClick={confirmDelete} className="danger-btn">Delete</button>
              <button onClick={() => setShowConfirm(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
