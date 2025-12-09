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
  AlertCircle
} from "lucide-react";
import { 
  getPendingInvestigators, 
  updateInvestigatorApproval,
  getInvestigatorApprovalHistory 
} from "../services/api";
import "./PendingInvestigators.css";

export default function PendingInvestigators() {
  const [pendingInvestigators, setPendingInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvestigator, setSelectedInvestigator] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadPendingInvestigators();
  }, []);

  const loadPendingInvestigators = async () => {
    try {
      setLoading(true);
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

  const handleApprove = async (investigatorId) => {
    if (!window.confirm("Are you sure you want to approve this investigator?")) return;
    
    try {
      setProcessingId(investigatorId);
      const response = await updateInvestigatorApproval(investigatorId, {
        is_approved: true,
        reason: "Account approved by admin"
      });
      
      if (response.ok) {
        alert("Investigator approved successfully!");
        loadPendingInvestigators();
      }
    } catch (err) {
      alert("Failed to approve investigator");
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (investigator) => {
    setSelectedInvestigator(investigator);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    try {
      setProcessingId(selectedInvestigator.id);
      const response = await updateInvestigatorApproval(selectedInvestigator.id, {
        is_approved: false,
        reason: rejectionReason
      });
      
      if (response.ok) {
        alert("Investigator rejected successfully!");
        setShowRejectModal(false);
        setRejectionReason("");
        setSelectedInvestigator(null);
        loadPendingInvestigators();
      }
    } catch (err) {
      alert("Failed to reject investigator");
      console.error(err);
    } finally {
      setProcessingId(null);
    }
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
            {pendingInvestigators.map((investigator) => (
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
                      <span>{investigator.certification}</span>
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
                </div>

                <div className="investigator-actions">
                  <button
                    className="btn-approve"
                    onClick={() => handleApprove(investigator.id)}
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
            ))}
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
    </div>
  );
}