// components/PendingInvestigators.jsx
import React, { useState, useEffect } from "react";
import { 
  UserCheck, 
  UserX, 
  Clock, 
  Mail, 
  Phone, 
  Briefcase,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  ExternalLink
} from "lucide-react";
import { 
  getPendingInvestigators, 
  updateInvestigatorApproval,
  getInvestigatorApprovalHistory 
} from "../services/api";
import "./PendingInvestigators.css";

// ── CERTIFICATION URL HELPER ────────────────────────────────────────────────
// The pending-investigators API is expected to return a `certification_url`
// (or `certification_path`) field per investigator pointing to the uploaded
// file. This normalizes either shape into an absolute-or-relative URL the
// browser can open. Adjust API_BASE_URL / the field name here if your
// backend uses a different convention (e.g. signed S3 URLs, a different
// field name, or a dedicated `/investigator/:id/certification` endpoint).
const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const getCertificationUrl = (investigator) => {
  const raw =
    investigator.certification_url ||
    investigator.certification_file_url ||
    investigator.certification_path ||
    investigator.certification;

  if (!raw) return null;

  if (raw.startsWith("http")) {
    return raw;
  }

  return `http://localhost:8000/${raw.replace(/^\/+/, "")}`;
};

const getCertificationFileName = (url) => {
  if (!url) return "";
  try {
    const clean = url.split("?")[0];
    return clean.substring(clean.lastIndexOf("/") + 1);
  } catch {
    return "";
  }
};

const isImageFile = (url) => /\.(png|jpe?g|gif|webp)$/i.test(url || "");

export default function PendingInvestigators() {
  const [pendingInvestigators, setPendingInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvestigator, setSelectedInvestigator] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingInvestigator, setApprovingInvestigator] = useState(null);
  // ✅ New: state for the certification document viewer modal
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [viewingInvestigator, setViewingInvestigator] = useState(null);

  useEffect(() => {
    loadPendingInvestigators();
  }, []);

  const loadPendingInvestigators = async () => {
    try {
      // ✅ Don't show loading spinner on refresh so message stays visible
      if (pendingInvestigators.length === 0) setLoading(true);
      const response = await getPendingInvestigators();
      const data = await response.json();
      setPendingInvestigators(data.pending_investigators || []);
    } catch (err) {
      setError("Failed to load pending investigators");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (investigator) => {
    // ✅ Show custom modal instead of browser native confirm
    setApprovingInvestigator(investigator);
    setShowApproveModal(true);
  };

  const confirmApprove = async () => {
    setShowApproveModal(false);
    try {
      setProcessingId(approvingInvestigator.id);
      const response = await updateInvestigatorApproval(approvingInvestigator.id, {
        is_approved: true,
        reason: "Account approved by admin"
      });
      
      if (response.ok) {
        // ✅ Load data first, THEN set message so reload doesn't wipe it
        await loadPendingInvestigators();
        setMessage({ 
          type: "success", 
          text: "✅ Investigator approved successfully! A confirmation email has been sent to the investigator." 
        });
        setTimeout(() => setMessage({ type: "", text: "" }), 6000);
      } else {
        const data = await response.json();
        setMessage({ 
          type: "error", 
          text: "❌ " + (data.detail || "Failed to approve investigator") 
        });
        setTimeout(() => setMessage({ type: "", text: "" }), 6000);
      }
    } catch (err) {
      setMessage({ type: "error", text: "❌ Failed to approve investigator" });
      setTimeout(() => setMessage({ type: "", text: "" }), 6000);
    } finally {
      setProcessingId(null);
      setApprovingInvestigator(null);
    }
  };

  const handleReject = (investigator) => {
    setSelectedInvestigator(investigator);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) {
      setMessage({ type: "error", text: "❌ Please provide a reason for rejection" });
      setTimeout(() => setMessage({ type: "", text: "" }), 6000);
      return;
    }

    try {
      setProcessingId(selectedInvestigator.id);
      const response = await updateInvestigatorApproval(selectedInvestigator.id, {
        is_approved: false,
        reason: rejectionReason
      });
      
      if (response.ok) {
        setShowRejectModal(false);
        setRejectionReason("");
        setSelectedInvestigator(null);
        // ✅ Load data first, THEN set message
        await loadPendingInvestigators();
        setMessage({ 
          type: "success", 
          text: "✅ Investigator rejected. A notification email has been sent to the investigator." 
        });
        setTimeout(() => setMessage({ type: "", text: "" }), 6000);
      } else {
        const data = await response.json();
        setMessage({ 
          type: "error", 
          text: "❌ " + (data.detail || "Failed to reject investigator") 
        });
        setTimeout(() => setMessage({ type: "", text: "" }), 6000);
      }
    } catch (err) {
      setMessage({ type: "error", text: "❌ Failed to reject investigator" });
      setTimeout(() => setMessage({ type: "", text: "" }), 6000);
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ New: open the certification document viewer modal
  const handleViewDocument = (investigator) => {
    setViewingInvestigator(investigator);
    setShowDocumentModal(true);
  };

  const closeDocumentModal = () => {
    setShowDocumentModal(false);
    setViewingInvestigator(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="pending-investigators-loading">
        <div className="spinner"></div>
        <p>Loading pending investigators...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pending-investigators-error">
        <AlertCircle size={48} />
        <h3>Error Loading Data</h3>
        <p>{error}</p>
        <button onClick={loadPendingInvestigators}>Retry</button>
      </div>
    );
  }

  return (
    <div className="pending-investigators-container">
      {message.text && (
        <div style={{
          padding: "14px 20px",
          marginBottom: "20px",
          borderRadius: "8px",
          fontWeight: "500",
          fontSize: "15px",
          backgroundColor: message.type === "success" ? "#d1fae5" : "#fee2e2",
          color: message.type === "success" ? "#065f46" : "#991b1b",
          border: `1px solid ${message.type === "success" ? "#6ee7b7" : "#fca5a5"}`,
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          {message.text}
        </div>
      )}
      <div className="pending-investigators-header">
        <h1>
          <Clock size={28} />
          Pending Investigator Approvals
        </h1>
        <p className="subtitle">
          Review and approve new investigator registrations
        </p>
      </div>

      {pendingInvestigators.length === 0 ? (
        <div className="no-pending-investigators">
          <CheckCircle size={64} />
          <h3>No Pending Approvals</h3>
          <p>All investigators have been reviewed and approved.</p>
        </div>
      ) : (
        <>
          <div className="stats-card">
            <div className="stat-item">
              <span className="stat-label">Pending Review</span>
              <span className="stat-value">{pendingInvestigators.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Waiting Since</span>
              <span className="stat-value">
                {formatDate(pendingInvestigators[0]?.created_at)}
              </span>
            </div>
          </div>

          <div className="pending-investigators-grid">
            {pendingInvestigators.map((investigator) => {
              const certUrl = getCertificationUrl(investigator);
              return (
                <div key={investigator.id} className="investigator-card pending">
                  <div className="investigator-card-header">
                    <div className="investigator-avatar">
                      <Briefcase size={24} />
                    </div>
                    <div className="investigator-info">
                      <h3>{investigator.name}</h3>
                      <div className="investigator-meta">
                        <span className="email">
                          <Mail size={14} />
                          {investigator.email}
                        </span>
                        {investigator.contact_number && (
                          <span className="phone">
                            <Phone size={14} />
                            {investigator.contact_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="pending-badge">
                      <Clock size={14} />
                      Pending
                    </span>
                  </div>

                  <div className="investigator-details">
                    {investigator.specialization && (
                      <div className="detail-item">
                        <strong>Specialization:</strong>
                        <span>{investigator.specialization}</span>
                      </div>
                    )}
                    {investigator.years_of_experience && (
                      <div className="detail-item">
                        <strong>Experience:</strong>
                        <span>{investigator.years_of_experience} years</span>
                      </div>
                    )}
                    {investigator.certification && (
                      <div className="detail-item">
  <strong>Certification:</strong>

  {certUrl ? (
    <button
      type="button"
      className="btn-view-document"
      onClick={() => handleViewDocument(investigator)}
    >
      <FileText size={14} />
      View Document
    </button>
  ) : (
    <span>Not provided</span>
  )}
</div>
                    )}
                    {investigator.department && (
                      <div className="detail-item">
                        <strong>Department:</strong>
                        <span>{investigator.department}</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Registered:</strong>
                      <span>{formatDate(investigator.created_at)}</span>
                    </div>
                    {/* ✅ New: certification document row with a view action */}
                    
                  </div>

                  <div className="investigator-actions">
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(investigator)}
                      disabled={processingId === investigator.id}
                    >
                      {processingId === investigator.id ? (
                        "Processing..."
                      ) : (
                        <>
                          <CheckCircle size={18} />
                          Approve
                        </>
                      )}
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleReject(investigator)}
                      disabled={processingId === investigator.id}
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedInvestigator && (
        <div className="modal-overlay">
          <div className="rejection-modal">
            <div className="modal-header">
              <h3>Reject Investigator Application</h3>
              <button 
                className="close-modal"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                You are about to reject <strong>{selectedInvestigator.name}</strong> 
                ({selectedInvestigator.email}). Please provide a reason for rejection:
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={4}
                className="rejection-reason-input"
              />
              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-confirm-reject"
                  onClick={confirmReject}
                  disabled={!rejectionReason.trim() || processingId === selectedInvestigator.id}
                >
                  {processingId === selectedInvestigator.id ? "Processing..." : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ✅ Approve Confirmation Modal */}
      {showApproveModal && approvingInvestigator && (
        <div className="modal-overlay">
          <div className="rejection-modal">
            <div className="modal-header">
              <h3>Approve Investigator</h3>
              <button
                className="close-modal"
                onClick={() => {
                  setShowApproveModal(false);
                  setApprovingInvestigator(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to approve <strong>{approvingInvestigator.name}</strong> ({approvingInvestigator.email})?
                An email will be sent to notify them.
              </p>
              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setShowApproveModal(false);
                    setApprovingInvestigator(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-approve"
                  onClick={confirmApprove}
                >
                  <CheckCircle size={16} />
                  Confirm Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ New: Certification Document Viewer Modal */}
      {showDocumentModal && viewingInvestigator && (
        <div className="modal-overlay" onClick={closeDocumentModal}>
          <div
            className="rejection-modal document-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                Certification {viewingInvestigator.name}
              </h3>
              <button className="close-modal" onClick={closeDocumentModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {(() => {
                const certUrl = getCertificationUrl(viewingInvestigator);
                if (!certUrl) {
                  return <p>No certification document was found for this investigator.</p>;
                }
                const fileName = getCertificationFileName(certUrl);
                return (
                  <>
                    <div className="document-preview">
                      {isImageFile(certUrl) ? (
                        <img
                          src={certUrl}
                          alt={`${viewingInvestigator.name} certification`}
                          className="document-preview-image"
                        />
                      ) : (
                        <iframe
                          src={certUrl}
                          title="Certification document"
                          className="document-preview-frame"
                        />
                      )}
                    </div>
                    <div className="modal-actions">
                      <span className="document-file-name">{fileName}</span>
                      <a
                        href={certUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-confirm-reject btn-open-new-tab"
                      >
                        <ExternalLink size={16} />
                        Open in New Tab
                      </a>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
