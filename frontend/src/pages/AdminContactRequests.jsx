// AdminContactRequests.jsx
import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Phone, 
  Calendar, 
  User, 
  MessageSquare, 
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  UserPlus,
  AlertTriangle,
  Download
} from "lucide-react";
import { 
  getContactRequests, 
  getContactRequest,
  updateContactRequest,
  deleteContactRequest,
  getInvestigators,
  convertContactRequestToCase
} from "../services/api";
import "./AdminContactRequests.css";

export default function AdminContactRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Convert form data
  const [convertData, setConvertData] = useState({
    investigator_id: "",
    case_name: "",
    category: "",
    priority: ""
  });

  useEffect(() => {
    loadRequests();
    loadInvestigators();
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = filter !== "all" ? { status: filter } : {};
      const response = await getContactRequests(params);
      const data = await response.json();
      setRequests(data.contact_requests || []);
    } catch (error) {
      console.error("Failed to load requests:", error);
      setMessage({ type: "error", text: "Failed to load contact requests" });
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

  const viewRequest = async (requestId) => {
    try {
      const response = await getContactRequest(requestId);
      const data = await response.json();
      setSelectedRequest(data.contact_request);
      setShowModal(true);
    } catch (error) {
      console.error("Failed to load request details:", error);
      setMessage({ type: "error", text: "Failed to load request details" });
    }
  };

  const handleUpdateStatus = async (requestId, newStatus) => {
    try {
      const response = await updateContactRequest(requestId, { status: newStatus });
      if (response.ok) {
        setMessage({ type: "success", text: `Request ${newStatus} successfully` });
        loadRequests();
        if (showModal) setShowModal(false);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      setMessage({ type: "error", text: "Failed to update status" });
    }
  };

  const handleAssignInvestigator = async (requestId, investigatorId) => {
    try {
      const response = await updateContactRequest(requestId, { 
        assigned_to: parseInt(investigatorId),
        status: "reviewing"
      });
      if (response.ok) {
        setMessage({ type: "success", text: "Investigator assigned successfully" });
        loadRequests();
        if (showModal) {
          viewRequest(requestId); // Reload details
        }
      }
    } catch (error) {
      console.error("Failed to assign investigator:", error);
      setMessage({ type: "error", text: "Failed to assign investigator" });
    }
  };

  const handleDelete = async (requestId) => {
    if (!confirm("Are you sure you want to delete this request?")) return;

    try {
      const response = await deleteContactRequest(requestId);
      if (response.ok) {
        setMessage({ type: "success", text: "Request deleted successfully" });
        loadRequests();
        if (showModal) setShowModal(false);
      }
    } catch (error) {
      console.error("Failed to delete request:", error);
      setMessage({ type: "error", text: "Failed to delete request" });
    }
  };

  const openConvertModal = (request) => {
    setSelectedRequest(request);
    setConvertData({
      investigator_id: request.assigned_to || "",
      case_name: `Case: ${request.subject}`,
      category: "General Investigation",
      priority: request.priority || "medium"
    });
    setShowConvertModal(true);
  };

  const handleConvertToCase = async (e) => {
    e.preventDefault();

    if (!convertData.investigator_id) {
      setMessage({ type: "error", text: "Please select an investigator" });
      return;
    }

    try {
      const payload = {
        contact_request_id: selectedRequest.id,  // Backend requires this!
        investigator_id: parseInt(convertData.investigator_id),
        case_name: convertData.case_name,
        category: convertData.category,
        priority: convertData.priority
      };
      
      console.log("Sending payload:", payload);
      
      const response = await convertContactRequestToCase(selectedRequest.id, payload);

      const data = await response.json();
      console.log("Response data:", data);

      if (response.ok) {
        setMessage({ type: "success", text: "Successfully converted to case!" });
        setShowConvertModal(false);
        setShowModal(false);
        loadRequests();
      } else {
        // Handle validation errors
        let errorMessage = "Failed to convert to case";
        if (data.detail) {
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            errorMessage = data.detail.map(err => err.msg || JSON.stringify(err)).join(', ');
          } else if (typeof data.detail === 'object') {
            errorMessage = JSON.stringify(data.detail);
          }
        }
        setMessage({ type: "error", text: errorMessage });
      }
    } catch (error) {
      console.error("Failed to convert to case:", error);
      setMessage({ type: "error", text: error.message || "Failed to convert to case" });
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: "warning", icon: Clock, text: "Pending" },
      reviewing: { color: "info", icon: Eye, text: "Reviewing" },
      approved: { color: "success", icon: CheckCircle, text: "Approved" },
      rejected: { color: "danger", icon: XCircle, text: "Rejected" },
      converted: { color: "primary", icon: CheckCircle, text: "Converted" }
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`status-badge ${badge.color}`}>
        <Icon size={14} />
        {badge.text}
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
      <span className={`priority-badge ${colors[priority] || colors.medium}`}>
        {priority || "medium"}
      </span>
    );
  };

  return (
    <div className="admin-contact-requests">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contact Requests</h1>
          <p className="page-subtitle">Review and manage incoming investigation requests</p>
        </div>
      </div>

      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: "", text: "" })}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-tabs">
          <button 
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All Requests
          </button>
          <button 
            className={filter === "pending" ? "active" : ""}
            onClick={() => setFilter("pending")}
          >
            <Clock size={16} />
            Pending
          </button>
          <button 
            className={filter === "reviewing" ? "active" : ""}
            onClick={() => setFilter("reviewing")}
          >
            <Eye size={16} />
            Reviewing
          </button>
          <button 
            className={filter === "approved" ? "active" : ""}
            onClick={() => setFilter("approved")}
          >
            <CheckCircle size={16} />
            Approved
          </button>
          <button 
            className={filter === "converted" ? "active" : ""}
            onClick={() => setFilter("converted")}
          >
            <FileText size={16} />
            Converted
          </button>
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="loading-state">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <Mail size={48} />
          <h3>No Contact Requests</h3>
          <p>There are no contact requests matching your filter.</p>
        </div>
      ) : (
        <div className="requests-table-container">
          <table className="requests-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Subject</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="id-cell">#{request.id}</td>
                  <td>
                    <div className="user-cell">
                      <User size={16} />
                      <span>{request.name}</span>
                    </div>
                  </td>
                  <td className="subject-cell">{request.subject}</td>
                  <td>{getPriorityBadge(request.priority)}</td>
                  <td>{getStatusBadge(request.status)}</td>
                  <td>
                    {request.assigned_investigator_name ? (
                      <span className="assigned-investigator">
                        <UserPlus size={14} />
                        {request.assigned_investigator_name}
                      </span>
                    ) : (
                      <span className="unassigned">Unassigned</span>
                    )}
                  </td>
                  <td className="date-cell">
                    {new Date(request.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-icon view"
                        onClick={() => viewRequest(request.id)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {request.status === "approved" && (
                        <button 
                          className="btn-icon convert"
                          onClick={() => openConvertModal(request)}
                          title="Convert to Case"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                      <button 
                        className="btn-icon delete"
                        onClick={() => handleDelete(request.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Request Modal */}
      {showModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Request Details</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="request-details">
                <div className="detail-group">
                  <label>Request ID</label>
                  <p>#{selectedRequest.id}</p>
                </div>

                <div className="detail-group">
                  <label>Status</label>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>

                <div className="detail-group">
                  <label>Priority</label>
                  <div>{getPriorityBadge(selectedRequest.priority)}</div>
                </div>

                <div className="detail-group">
                  <label><User size={16} /> Name</label>
                  <p>{selectedRequest.name}</p>
                </div>

                <div className="detail-group">
                  <label><Mail size={16} /> Email</label>
                  <p>{selectedRequest.email}</p>
                </div>

                {selectedRequest.phone && (
                  <div className="detail-group">
                    <label><Phone size={16} /> Phone</label>
                    <p>{selectedRequest.phone}</p>
                  </div>
                )}

                <div className="detail-group full-width">
                  <label><MessageSquare size={16} /> Subject</label>
                  <p>{selectedRequest.subject}</p>
                </div>

                <div className="detail-group full-width">
                  <label><FileText size={16} /> Message</label>
                  <p className="message-text">{selectedRequest.message}</p>
                </div>

                {selectedRequest.evidence_files && selectedRequest.evidence_files.length > 0 && (
                  <div className="detail-group full-width">
                    <label><Download size={16} /> Evidence Files</label>
                    <div className="evidence-files">
                      {selectedRequest.evidence_files.map((file, index) => (
                        <a 
                          key={index} 
                          href={`http://127.0.0.1:8000/${file}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="evidence-file-link"
                        >
                          <FileText size={16} />
                          {file.split('/').pop()}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="detail-group">
                  <label><Calendar size={16} /> Submitted</label>
                  <p>{new Date(selectedRequest.created_at).toLocaleString()}</p>
                </div>

                {selectedRequest.assigned_investigator_name && (
                  <div className="detail-group full-width">
                    <label><UserPlus size={16} /> Assigned Investigator</label>
                    <p className="assigned-info">
                      {selectedRequest.assigned_investigator_name}
                      <span className="assigned-email">({selectedRequest.assigned_investigator_email})</span>
                    </p>
                  </div>
                )}

                {selectedRequest.admin_notes && (
                  <div className="detail-group full-width">
                    <label><AlertTriangle size={16} /> Admin Notes</label>
                    <p className="admin-notes">{selectedRequest.admin_notes}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="modal-actions">
                {selectedRequest.status === "pending" && (
                  <>
                    <button 
                      className="btn-action approve"
                      onClick={() => handleUpdateStatus(selectedRequest.id, "approved")}
                    >
                      <CheckCircle size={16} />
                      Approve
                    </button>
                    <button 
                      className="btn-action reject"
                      onClick={() => handleUpdateStatus(selectedRequest.id, "rejected")}
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </>
                )}
              
                {selectedRequest.status === "approved" && selectedRequest.status !== "converted" && (
                  <button 
                    className="btn-action convert"
                    onClick={() => openConvertModal(selectedRequest)}
                  >
                    <FileText size={16} />
                    Convert to Case
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Case Modal */}
      {showConvertModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowConvertModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Convert to Case</h2>
              <button className="modal-close" onClick={() => setShowConvertModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Assign Investigator *</label>
                <select 
                  value={convertData.investigator_id}
                  onChange={(e) => setConvertData({...convertData, investigator_id: e.target.value})}
                  required
                  className="form-input"
                >
                  <option value="">Select Investigator</option>
                  {investigators.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} - {inv.specialization} ({inv.active_cases} active)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Case Name *</label>
                <input 
                  type="text"
                  value={convertData.case_name}
                  onChange={(e) => setConvertData({...convertData, case_name: e.target.value})}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select 
                  value={convertData.category}
                  onChange={(e) => setConvertData({...convertData, category: e.target.value})}
                  className="form-input"
                >
                  <option value="General Investigation">General Investigation</option>
                  <option value="Digital Forensics">Digital Forensics</option>
                  <option value="Crime Scene">Crime Scene</option>
                  <option value="Cybercrime">Cybercrime</option>
                  <option value="Financial Fraud">Financial Fraud</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select 
                  value={convertData.priority}
                  onChange={(e) => setConvertData({...convertData, priority: e.target.value})}
                  className="form-input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn-action convert"
                  onClick={handleConvertToCase}
                >
                  <FileText size={16} />
                  Create Case
                </button>
                <button 
                  type="button" 
                  className="btn-action cancel"
                  onClick={() => setShowConvertModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}