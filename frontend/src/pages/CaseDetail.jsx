// pages/CaseDetail.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getCase,
  uploadEvidence,
  updateCase,
  runObjectDetection,
  getObjectDetectionResults,
  deleteDetectionResult,
  deleteEvidence,
  getCurrentUser,
  getModelsInfo,
  addWitnessStatement,
  getWitnessStatements,
  deleteWitnessStatement,
  generateCaseReport,
  listCaseReports,
  deleteCaseReport,
} from "../services/api";
import "./CaseDetail.css";
import ForensicReportRenderer from "./ForensicReportRenderer";

const validatePakistaniPhone = (phone) => {
  if (!phone || phone.trim() === "") return true;
  const cleaned = phone.replace(/[\s\-]/g, ""); // remove spaces and dashes
  // Covers: 03XXXXXXXXX (11 digits), +923XXXXXXXXX, 00923XXXXXXXXX, 923XXXXXXXXX
  const pattern = /^(\+92|0092|92|0)3[0-9]{9}$/;
  return pattern.test(cleaned);
};

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const fileInputRef = useRef(null);
  const resultsSectionRef = useRef(null);

  const [data, setData] = useState(null);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    incident_date: "",
    category: "",
    priority: "",
    client: "",
    investigating_officer: "",
    status: "",
  });

  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState("");
  const [selectedModel, setSelectedModel] = useState("crime_scene");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.25);
  const [runningDetection, setRunningDetection] = useState(false);
  const [detectionResults, setDetectionResults] = useState([]);
  const [detectionMessage, setDetectionMessage] = useState({
    type: "",
    text: "",
  });
  const [deletingResultId, setDeletingResultId] = useState(null);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);

  const [witnessStatements, setWitnessStatements] = useState([]);
  const [showWitnessForm, setShowWitnessForm] = useState(false);
  const [witnessForm, setWitnessForm] = useState({
    witness_name: "",
    statement: "",
    contact_info: "",
    statement_date: "",
  });
  const [addingWitness, setAddingWitness] = useState(false);
  const [deletingWitnessId, setDeletingWitnessId] = useState(null);

  const [generatingReport, setGeneratingReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportError, setReportError] = useState("");
  const [reportFullscreen, setReportFullscreen] = useState(false);
  const [savedReports, setSavedReports] = useState([]);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalForm, setOriginalForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // add this state at top

  

  const load = async () => {
    try {
      const res = await getCase(id);
      if (res.ok) {
        const d = await res.json();
        setData(d);

        setEditForm({
          name: d.case.name || "",
          description: d.case.description || "",
          incident_date: d.case.incident_date
            ? d.case.incident_date.split("T")[0]
            : "",
          category: d.case.category || "",
          priority: d.case.priority || "",
          client: d.case.client || "",
          investigating_officer: d.case.investigating_officer || "",
          status: d.case.status || "New",
        });

        const initialForm = {
          name: d.case.name || "",
          description: d.case.description || "",
          incident_date: d.case.incident_date
            ? d.case.incident_date.split("T")[0]
            : "",
          category: d.case.category || "",
          priority: d.case.priority || "",
          client: d.case.client || "",
          investigating_officer: d.case.investigating_officer || "",
          status: d.case.status || "New",
        };
        setEditForm(initialForm);
        setOriginalForm(initialForm);
        setHasChanges(false);

        await loadDetectionResults();
        await loadWitnessStatements();
        await loadSavedReports();
      } else if (res.status === 401) {
        alert("Session expired. Please login again.");
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else if (res.status === 403) {
        alert("You do not have access to this case.");
        navigate("/dashboard/cases");
      }
    } catch (error) {
      console.error("Error loading case:", error);
    }
  };

  const loadDetectionResults = async () => {
    try {
      const response = await getObjectDetectionResults(id);
      const data = await response.json();
      setDetectionResults(data.detection_results || []);
    } catch (error) {
      console.error("Error loading detection results:", error);
    }
  };

  const loadWitnessStatements = async () => {
    try {
      const response = await getWitnessStatements(id);
      const data = await response.json();
      setWitnessStatements(data.witness_statements || []);
    } catch (error) {
      console.error("Error loading witness statements:", error);
    }
  };

  const loadSavedReports = async () => {
    try {
      const response = await listCaseReports(id);
      const data = await response.json();
      setSavedReports(data.reports || []);
    } catch (error) {
      console.error("Error loading saved reports:", error);
    }
  };

  const loadModelsInfo = async () => {
    try {
      const response = await getModelsInfo();
      const data = await response.json();
      setAvailableModels(data.available_models || []);
    } catch (error) {
      console.error("Error loading models info:", error);
    }
  };

  useEffect(() => {
    load();
    loadModelsInfo();
  }, [id]);

  const handleEditChange = (e) => {
    const updated = { ...editForm, [e.target.name]: e.target.value };
    setEditForm(updated);

    // Check if anything changed from original
    if (originalForm) {
      const changed = Object.keys(updated).some(
        (key) => updated[key] !== originalForm[key],
      );
      setHasChanges(changed);
    }
  };

  const handleSaveEdit = async () => {
    setUpdating(true);
    setMessage("");
    try {
      // Fix: send null if date is empty, otherwise append time
      const payload = {
        ...editForm,
        incident_date: editForm.incident_date
          ? `${editForm.incident_date}T00:00:00`
          : null,
      };

      const response = await updateCase(id, payload);
      if (response.ok) {
        setMessage("✅ Case updated successfully");
        setIsEditing(false);
        load();
      } else {
        const errorData = await response.json();
        setMessage(
          "❌ Failed to update case: " + (errorData.detail || "Unknown error"),
        );
      }
    } catch (error) {
      setMessage("❌ Error updating case: " + error.message);
    }
    setUpdating(false);
  };

  const handleCancelEdit = () => {
    if (originalForm) {
      setEditForm(originalForm);
    }
    setHasChanges(false);
    setIsEditing(false);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Select a file first!");
      return;
    }
    setUploading(true);
    try {
      const res = await uploadEvidence(id, file);
      if (res.ok) {
        setMessage("Evidence uploaded successfully.");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        load();
      } else {
        setMessage("Upload failed.");
      }
    } catch (error) {
      setMessage("Upload failed.");
    }
    setUploading(false);
  };

  // ── Navigate to the 3D reconstruction page ──────────────────────────────
  const handle3d = () => navigate(`/dashboard/cases/${id}/reconstruct`);

  const handleOpenDetectionModal = () => {
    const imageEvidence = getImageEvidence();
    if (imageEvidence.length === 0) {
      setMessage("No image evidence available for object detection");
      return;
    }
    setShowDetectionModal(true);
    setDetectionMessage({ type: "", text: "" });
    setSelectedEvidence("");
    setSelectedModel("crime_scene");
    setConfidenceThreshold(0.25);
  };

  const getImageEvidence = () => {
    if (!data || !data.evidence) return [];
    return data.evidence.filter((ev) =>
      ev.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/),
    );
  };

  const handleRunDetection = async (runOnAll = false) => {
    setRunningDetection(true);
    setDetectionMessage({ type: "", text: "" });

    try {
      const options = {
        modelType: selectedModel,
        confThreshold: confidenceThreshold,
      };

      if (!runOnAll) {
        if (!selectedEvidence) {
          setDetectionMessage({
            type: "error",
            text: "Please select an evidence file to analyze",
          });
          setRunningDetection(false);
          return;
        }
        options.evidenceId = parseInt(selectedEvidence);
      }

      const response = await runObjectDetection(id, options);
      const result = await response.json();

      if (response.ok) {
        setDetectionMessage({
          type: "success",
          text: result.message || "Object detection completed successfully",
        });
        await loadDetectionResults();
        setTimeout(() => {
          setShowDetectionModal(false);
          setTimeout(() => {
            if (resultsSectionRef.current) {
              resultsSectionRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          }, 100);
        }, 1000);
      } else {
        setDetectionMessage({
          type: "error",
          text: result.detail || "Detection failed. Please try again.",
        });
      }
    } catch (error) {
      setDetectionMessage({
        type: "error",
        text: error.message || "Object detection failed. Please try again.",
      });
    } finally {
      setRunningDetection(false);
    }
  };

  const handleDeleteDetectionResult = async (resultId) => {
  setConfirmDelete({ type: 'detection', id: resultId });
};

  const handleDeleteEvidence = async (evidenceId, filename) => {
  setConfirmDelete({ type: 'evidence', id: evidenceId, name: filename });
};
  const handleWitnessFormChange = (e) => {
    setWitnessForm({ ...witnessForm, [e.target.name]: e.target.value });
  };

  const handleAddWitnessStatement = async () => {
    if (!witnessForm.witness_name.trim() || !witnessForm.statement.trim()) {
      setMessage("Please fill in witness name and statement");
      return;
    }

    // ✅ Pakistan phone validation on contact_info
    if (
      witnessForm.contact_info &&
      !validatePakistaniPhone(witnessForm.contact_info)
    ) {
      setMessage(
        "Invalid phone number. Use format: 03XX-XXXXXXX or +923XXXXXXXXX",
      );
      return;
    }

    setAddingWitness(true);
    try {
      const response = await addWitnessStatement(id, witnessForm);
      if (response.ok) {
        setMessage("Witness statement added successfully");
        setShowWitnessForm(false);
        setWitnessForm({
          witness_name: "",
          statement: "",
          contact_info: "",
          statement_date: "",
        });
        await loadWitnessStatements();
      } else {
        const errorData = await response.json();
        setMessage(
          "Failed to add witness statement: " +
            (errorData.detail || "Unknown error"),
        );
      }
    } catch (error) {
      setMessage("Error adding witness statement: " + error.message);
    } finally {
      setAddingWitness(false);
    }
  };

  const handleDeleteWitnessStatement = async (witnessId) => {
    if (
      !window.confirm("Are you sure you want to delete this witness statement?")
    )
      return;
    setDeletingWitnessId(witnessId);
    try {
      const response = await deleteWitnessStatement(witnessId);
      if (response.ok) {
        setMessage("Witness statement deleted successfully");
        await loadWitnessStatements();
      } else {
        const errorData = await response.json();
        setMessage(
          "Failed to delete witness statement: " +
            (errorData.detail || "Unknown error"),
        );
      }
    } catch (error) {
      setMessage("Error deleting witness statement: " + error.message);
    } finally {
      setDeletingWitnessId(null);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setReportError("");
    setReportData(null);
    setShowReportModal(true);
    try {
      const response = await generateCaseReport(id);
      const result = await response.json();
      if (response.ok) {
        setReportData(result);
        await loadSavedReports();
      } else {
        setReportError(
          result.detail || "Failed to generate report. Please try again.",
        );
      }
    } catch (error) {
      setReportError(
        error.message || "Report generation failed. Please try again.",
      );
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (reportData?.report) {
      navigator.clipboard.writeText(reportData.report);
      setMessage("Report copied to clipboard");
    }
  };

  const handleDownloadReport = () => {
    if (!reportData?.report) return;
    const blob = new Blob([reportData.report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forensic_report_case_${id}_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSavedReport = async (reportId) => {
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    setDeletingReportId(reportId);
    try {
      const response = await deleteCaseReport(reportId);
      if (response.ok) {
        setMessage("Report deleted successfully");
        await loadSavedReports();
      } else {
        const err = await response.json();
        setMessage(
          "Failed to delete report: " + (err.detail || "Unknown error"),
        );
      }
    } catch (error) {
      setMessage("Error deleting report: " + error.message);
    } finally {
      setDeletingReportId(null);
    }
  };

  const handleViewSavedReport = (report) => {
    setReportData({
      id: report.id,
      case_name: data?.case?.name,
      generated_at: report.created_at,
      report: report.report_text,
      evidence_count: report.evidence_count,
      detection_count: report.detection_count,
      witness_count: report.witness_count,
    });
    setReportError("");
    setShowReportModal(true);
  };

  const formatConfidence = (confidence) => `${(confidence * 100).toFixed(1)}%`;

  const getEvidenceFilename = (evidenceId) => {
    if (!data || !data.evidence) return `Evidence #${evidenceId}`;
    const evidenceItem = data.evidence.find((item) => item.id === evidenceId);
    return evidenceItem ? evidenceItem.filename : `Evidence #${evidenceId}`;
  };

  const getModelName = (modelType) => {
    if (modelType === "blood" || modelType === "blood_detection")
      return "Blood Detection";
    return "Crime Scene Detection";
  };

  if (!data) return <div className="loading">Loading case details...</div>;

  const { case: caseData, evidence } = data;
  const imageEvidence = getImageEvidence();

  return (
    <div className="case-detail-container">
      {/* Case Header */}
      <div className="case-header">
        <div className="case-title-section">
          {!isEditing ? (
            <>
              <div className="case-title-row">
                <h1 className="case-title">{caseData.name}</h1>
                <div className="case-header-actions">
                  <button
                    className="edit-case-btn"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Case
                  </button>
                </div>
              </div>
              <div className="case-meta">
                <span className="case-id">Case #{caseData.id}</span>
                <span
                  className={`status-badge large ${caseData.status?.toLowerCase() || "new"}`}
                >
                  {caseData.status || "New"}
                </span>
                {caseData.priority && (
                  <span
                    className={`priority-badge large ${caseData.priority.toLowerCase()}`}
                  >
                    {caseData.priority} Priority
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="edit-mode-header">
              <h2>Edit Case Details</h2>
              <div className="edit-actions">
                <button
                  className="btn-save-edit"
                  onClick={handleSaveEdit}
                  disabled={updating || !hasChanges}
                  title={!hasChanges ? "No changes to save" : "Save changes"}
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
                <button
                  className="btn-cancel-edit"
                  onClick={handleCancelEdit}
                  disabled={updating}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {!isEditing ? (
          <div className="case-info-grid">
            <div className="info-item">
              <label>Category:</label>
              <span>{caseData.category || "Not specified"}</span>
            </div>
            <div className="info-item">
              <label>Client:</label>
              <span>{caseData.client || "Not specified"}</span>
            </div>
            <div className="info-item">
              <label>Investigating Officer:</label>
              <span>{caseData.investigating_officer || "Not assigned"}</span>
            </div>
            <div className="info-item">
              <label>Incident Date:</label>
              <span>
                {caseData.incident_date
                  ? new Date(caseData.incident_date).toLocaleDateString()
                  : "Not specified"}
              </span>
            </div>
            <div className="info-item">
              <label>Created By:</label>
              <span>{caseData.user_name || "Unknown"}</span>
            </div>
            <div className="info-item">
              <label>Created At:</label>
              <span>{new Date(caseData.created_at).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="edit-form">
            <div className="form-group">
              <label>Case Name *</label>
              <input
                type="text"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                >
                  <option value="New">New</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  name="priority"
                  value={editForm.priority}
                  onChange={handleEditChange}
                >
                  <option value="">Select</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  name="category"
                  value={editForm.category}
                  onChange={handleEditChange}
                >
                  <option value="">Select</option>
                  <option value="Theft">Theft</option>
                  <option value="Cybercrime">Cybercrime</option>
                  <option value="Accident Reconstruction">
                    Accident Reconstruction
                  </option>
                  <option value="General Investigation">
                    General Investigation
                  </option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Incident Date</label>
                <input
                  type="date"
                  name="incident_date"
                  value={editForm.incident_date}
                  onChange={handleEditChange}
                />
              </div>
              <div className="form-group">
                <label>Client/Department</label>
                <input
                  type="text"
                  name="client"
                  value={editForm.client}
                  onChange={handleEditChange}
                  placeholder="Enter client or department"
                />
              </div>
              <div className="form-group">
                <label>Investigating Officer</label>
                <input
                  type="text"
                  name="investigating_officer"
                  value={editForm.investigating_officer}
                  onChange={handleEditChange}
                  placeholder="Enter officer name"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={editForm.description}
                onChange={handleEditChange}
                rows="5"
                placeholder="Enter case description"
              />
            </div>
          </div>
        )}
      </div>

      {!isEditing && caseData.description && (
        <section className="description-section">
          <h3>Description</h3>
          <p className="case-description">{caseData.description}</p>
        </section>
      )}

      {/* Witness Statements Section */}
      <section className="witness-statements-section">
        <div className="section-header">
          <h3>👥 Witness Statements</h3>
          <div className="section-header-actions">
            <span className="evidence-count">
              {witnessStatements.length} statements
            </span>
            <button
              className="add-witness-btn"
              onClick={() => setShowWitnessForm(!showWitnessForm)}
            >
              {showWitnessForm ? "Cancel" : "+ Add Statement"}
            </button>
          </div>
        </div>

        {showWitnessForm && (
          <div className="witness-form">
            <div className="form-row">
              <div className="form-group">
                <label>Witness Name *</label>
                <input
                  type="text"
                  name="witness_name"
                  value={witnessForm.witness_name}
                  onChange={handleWitnessFormChange}
                  placeholder="Enter witness name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Statement Date</label>
                <input
                  type="date"
                  name="statement_date"
                  value={witnessForm.statement_date}
                  onChange={handleWitnessFormChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Contact Information</label>
              <input
                type="text"
                name="contact_info"
                value={witnessForm.contact_info}
                onChange={handleWitnessFormChange}
                placeholder="Phone number, email, or address"
              />
            </div>
            <div className="form-group">
              <label>Statement *</label>
              <textarea
                name="statement"
                value={witnessForm.statement}
                onChange={handleWitnessFormChange}
                rows="4"
                placeholder="Enter witness statement"
                required
              />
            </div>
            <div className="form-actions">
              <button
                className="btn-save-edit"
                onClick={handleAddWitnessStatement}
                disabled={addingWitness}
              >
                {addingWitness ? "Adding..." : "Add Statement"}
              </button>
              <button
                className="btn-cancel-edit"
                onClick={() => setShowWitnessForm(false)}
                disabled={addingWitness}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="witness-list">
          {witnessStatements.length === 0 ? (
            <div className="empty-state">
              <p>No witness statements added yet</p>
              <small>Add witness statements using the + button above</small>
            </div>
          ) : (
            witnessStatements.map((witness) => (
              <div key={witness.id} className="witness-card">
                <button
                  className="delete-witness-btn"
                  onClick={() => handleDeleteWitnessStatement(witness.id)}
                  disabled={deletingWitnessId === witness.id}
                  title="Delete witness statement"
                >
                  {deletingWitnessId === witness.id ? "⏳" : "×"}
                </button>
                <div className="witness-header">
                  <h4 className="witness-name">{witness.witness_name}</h4>
                  {witness.statement_date && (
                    <span className="witness-date">
                      📅 {new Date(witness.statement_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {witness.contact_info && (
                  <div className="witness-contact">
                    <span className="contact-label">Contact:</span>
                    <span className="contact-info">{witness.contact_info}</span>
                  </div>
                )}
                <div className="witness-statement">
                  <p>{witness.statement}</p>
                </div>
                <div className="witness-footer">
                  <small className="witness-timestamp">
                    Added: {new Date(witness.created_at).toLocaleString()}
                  </small>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Analysis Tools Section */}
      <section className="analysis-tools-section">
        <div className="section-header">
          <h3>🔬 Analysis Tools</h3>
        </div>
        <div className="analysis-tools-grid">
          <div className="analysis-tool-card">
            <div className="tool-icon">🔍</div>
            <h4>Object Detection</h4>
            <p>AI-powered object recognition in images</p>
            <button
              onClick={handleOpenDetectionModal}
              className="tool-btn primary"
              disabled={imageEvidence.length === 0}
            >
              {imageEvidence.length === 0 ? "No Images" : "Run Detection"}
            </button>
            <small className="tool-hint">
              {imageEvidence.length} image
              {imageEvidence.length !== 1 ? "s" : ""} available
            </small>
          </div>

          <div className="analysis-tool-card">
            <div className="tool-icon">📐</div>
            <h4>3D Reconstruction</h4>
            <p>Create 3D models from evidence</p>
            <button onClick={handle3d} className="tool-btn secondary">
              Generate 3D
            </button>
            <small className="tool-hint">Requires multiple angle images</small>
          </div>

          <div className="analysis-tool-card">
            <div className="tool-icon">📄</div>
            <h4>Forensic Report</h4>
            <p>Generate AI-assisted forensic report</p>
            <button
              className="tool-btn tertiary"
              onClick={handleGenerateReport}
              disabled={generatingReport}
            >
              {generatingReport ? (
                <>
                  <span className="loading-spinner"></span> Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </button>
            <small className="tool-hint">Powered by Gemini AI</small>
          </div>
        </div>
      </section>

      {message && <div className="message-banner">{message}</div>}

      {/* Evidence Section */}
      <section className="evidence-section">
        <div className="section-header">
          <h3>Evidence</h3>
          <div className="section-header-actions">
            <span className="evidence-count">{evidence.length} files</span>
            <div className="upload-controls">
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="file-input"
                id="evidence-file-input"
                style={{ display: "none" }}
              />
              <label htmlFor="evidence-file-input" className="file-input-label">
                <span className="file-icon">📎</span>
                {file ? file.name : "Choose File"}
              </label>
              <button
                onClick={handleUpload}
                className="upload-btn"
                disabled={uploading || !file}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>

        <div className="evidence-list">
          {evidence.length === 0 ? (
            <div className="empty-state">
              <p>No evidence uploaded yet</p>
              <small>Upload images, documents, or other case files</small>
            </div>
          ) : (
            <div className="evidence-grid">
              {evidence.map((ev) => (
                <div key={ev.id} className="evidence-card">
                  <button
                    className="delete-evidence-btn"
                    onClick={() => handleDeleteEvidence(ev.id, ev.filename)}
                    disabled={deletingEvidenceId === ev.id}
                    title="Delete evidence"
                  >
                    {deletingEvidenceId === ev.id ? "⏳" : "×"}
                  </button>
                  <div className="evidence-preview">
                    {ev.filename
                      .toLowerCase()
                      .match(/\.(jpg|jpeg|png|gif|bmp|webp)$/) ? (
                      <img
                        src={`http://127.0.0.1:8000/uploads/${ev.filename}`}
                        alt={ev.filename}
                        className="evidence-image"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="file-icon"
                      style={{
                        display: ev.filename
                          .toLowerCase()
                          .match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)
                          ? "none"
                          : "flex",
                      }}
                    >
                      {ev.filename.toLowerCase().match(/\.(pdf)$/)
                        ? "📄"
                        : ev.filename.toLowerCase().match(/\.(mp4|avi|mov)$/)
                          ? "🎥"
                          : ev.filename.toLowerCase().match(/\.(doc|docx)$/)
                            ? "📝"
                            : "📁"}
                    </div>
                  </div>
                  <div className="evidence-info">
                    <a
                      href={`http://127.0.0.1:8000/uploads/${ev.filename}`}
                      target="_blank"
                      rel="noreferrer"
                      className="evidence-link"
                    >
                      {ev.filename}
                    </a>
                    <small>{new Date(ev.uploaded_at).toLocaleString()}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Detection Results */}
      {detectionResults.length > 0 && (
        <section className="detection-results-section" ref={resultsSectionRef}>
          <div className="section-header">
            <h3>🔍 Detection Results</h3>
            <span className="evidence-count">
              {detectionResults.length} analyzed
            </span>
          </div>

          <div className="detection-results-horizontal">
            {detectionResults.map((result) => {
              const detectionData = result.results;
              const detections = detectionData?.detections || [];
              const evidenceItem = data.evidence.find(
                (ev) => ev.id === result.evidence_id,
              );
              const imagePath = evidenceItem
                ? `http://127.0.0.1:8000/uploads/${evidenceItem.filename}`
                : null;

              return (
                <div
                  key={result.id}
                  className="detection-result-horizontal-card"
                >
                  <button
                    className="delete-result-btn-horizontal"
                    onClick={() => handleDeleteDetectionResult(result.id)}
                    disabled={deletingResultId === result.id}
                    title="Delete detection result"
                  >
                    {deletingResultId === result.id ? "⏳" : "×"}
                  </button>
                  <div className="detection-image-container">
                    {imagePath && (
                      <div
                        className="detection-image-wrapper"
                        style={{
                          position: "relative",
                          display: "inline-block",
                          lineHeight: 0,
                        }}
                      >
                        <img
                          src={imagePath}
                          alt={getEvidenceFilename(result.evidence_id)}
                          className="detection-result-image"
                          style={{
                            display: "block",
                            width: "100%",
                            height: "auto",
                            maxHeight: "300px",
                            objectFit: "contain",
                          }}
                        />
                        {(() => {
                          const imgW =
                            detectionData?.image_dimensions?.width || 640;
                          const imgH =
                            detectionData?.image_dimensions?.height || 640;
                          return (
                            <svg
                              viewBox={`0 0 ${imgW} ${imgH}`}
                              preserveAspectRatio="xMidYMid meet"
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                pointerEvents: "none",
                              }}
                            >
                              {detections.map((detection, idx) => {
                                const bbox = detection.bbox;
                                const colors = [
                                  "#3b82f6",
                                  "#10b981",
                                  "#f59e0b",
                                  "#ef4444",
                                  "#8b5cf6",
                                  "#ec4899",
                                ];
                                const color = colors[idx % colors.length];
                                const fontSize = Math.max(imgW, imgH) * 0.022;
                                const labelH = fontSize * 1.6;
                                const labelW =
                                  (detection.class_name.length + 6) *
                                  fontSize *
                                  0.65;
                                const labelY =
                                  bbox.y1 >= labelH
                                    ? bbox.y1 - labelH
                                    : bbox.y1 + labelH;
                                const textY =
                                  bbox.y1 >= labelH
                                    ? bbox.y1 - labelH * 0.25
                                    : bbox.y1 + labelH * 0.85;

                                return (
                                  <g key={idx}>
                                    <rect
                                      x={bbox.x1}
                                      y={bbox.y1}
                                      width={bbox.x2 - bbox.x1}
                                      height={bbox.y2 - bbox.y1}
                                      fill="none"
                                      stroke={color}
                                      strokeWidth={Math.max(imgW, imgH) * 0.004}
                                      opacity="0.9"
                                    />
                                    <rect
                                      x={bbox.x1}
                                      y={labelY}
                                      width={labelW}
                                      height={labelH}
                                      fill={color}
                                      opacity="0.9"
                                      rx={fontSize * 0.2}
                                    />
                                    <text
                                      x={bbox.x1 + fontSize * 0.3}
                                      y={textY}
                                      fill="white"
                                      fontSize={fontSize}
                                      fontWeight="bold"
                                    >
                                      {detection.class_name}{" "}
                                      {formatConfidence(detection.confidence)}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="detection-details-container">
                    <div className="detection-header-row">
                      <div>
                        <h4 className="detection-title">
                          {getEvidenceFilename(result.evidence_id)}
                        </h4>
                        <div className="detection-meta">
                          {result.model_type && (
                            <span className="model-badge-horizontal">
                              {getModelName(result.model_type)}
                            </span>
                          )}
                          {detectionData?.total_detections > 0 && (
                            <span className="detection-count-badge">
                              {detectionData.total_detections} objects detected
                            </span>
                          )}
                        </div>
                      </div>
                      {detectionData?.image_dimensions && (
                        <div className="detection-stats-mini">
                          <div className="stat-mini">
                            <span className="stat-value-mini resolution-display">
                              {detectionData.image_dimensions.width}×
                              {detectionData.image_dimensions.height}
                            </span>
                            <span className="stat-label-mini">Resolution</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="detections-grid">
                      {detections.length > 0 ? (
                        detections.map((detection, index) => (
                          <div key={index} className="detection-chip">
                            <span className="chip-icon">🎯</span>
                            <div className="chip-content">
                              <span className="chip-label">
                                {detection.class_name}
                              </span>
                              <span className="chip-confidence">
                                {formatConfidence(detection.confidence)}
                              </span>
                            </div>
                            {detection.category && (
                              <span className="chip-category">
                                {detection.category}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="no-detections-horizontal">
                          <span>⚠️ No objects detected in this image</span>
                        </div>
                      )}
                    </div>
                    {detectionData?.category_counts &&
                      Object.keys(detectionData.category_counts).length > 0 && (
                        <div className="category-summary">
                          <strong>Categories Found:</strong>
                          {Object.entries(detectionData.category_counts).map(
                            ([category, count]) => (
                              <span key={category} className="category-tag">
                                {category} ({count})
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    <div className="detection-timestamp">
                      📅 Analyzed:{" "}
                      {new Date(result.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Saved Reports Section */}
      <section className="saved-reports-section">
        <div className="section-header">
          <h3>📄 Forensic Reports</h3>
          <span className="evidence-count">
            {savedReports.length} report{savedReports.length !== 1 ? "s" : ""}
          </span>
        </div>
        {savedReports.length === 0 ? (
          <div className="empty-state">
            <p>No reports generated yet</p>
            <small>
              Use the Generate Report button in Analysis Tools to create one
            </small>
          </div>
        ) : (
          <div className="saved-reports-list">
            {savedReports.map((report) => (
              <div key={report.id} className="saved-report-card">
                <div className="saved-report-info">
                  <div className="saved-report-meta">
                    <span className="report-meta-item">
                      🖼️ {report.evidence_count} evidence
                    </span>
                    <span className="report-meta-item">
                      🔍 {report.detection_count} detections
                    </span>
                    <span className="report-meta-item">
                      👥 {report.witness_count} witnesses
                    </span>
                    {report.generated_by && (
                      <span className="report-meta-item">
                        👤 {report.generated_by}
                      </span>
                    )}
                  </div>
                  <div className="saved-report-timestamp">
                    🕒 Generated: {new Date(report.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="saved-report-actions">
                  <button
                    className="btn-view-report"
                    onClick={() => handleViewSavedReport(report)}
                  >
                    👁 View
                  </button>
                  <button
                    className="delete-witness-btn"
                    onClick={() => handleDeleteSavedReport(report.id)}
                    disabled={deletingReportId === report.id}
                    title="Delete report"
                    style={{
                      position: "static",
                      width: "32px",
                      height: "32px",
                    }}
                  >
                    {deletingReportId === report.id ? "⏳" : "×"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Object Detection Modal */}
      {showDetectionModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDetectionModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Run Object Detection</h3>
              <button
                className="modal-close"
                onClick={() => setShowDetectionModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {detectionMessage.text && (
                <div className={`detection-message ${detectionMessage.type}`}>
                  {detectionMessage.text}
                </div>
              )}
              <div className="detection-settings">
                <div className="form-group">
                  <div className="model-info-box">
                    <strong>Object Detection AI</strong>
                    <p className="model-description">
                      Detects weapons, blood evidence, glass, and human presence
                      in crime scenes.
                    </p>
                  </div>
                </div>
                <div className="form-group">
                  <label>Select Evidence to Analyze:</label>
                  <select
                    value={selectedEvidence}
                    onChange={(e) => setSelectedEvidence(e.target.value)}
                    disabled={runningDetection}
                    className="evidence-select"
                  >
                    <option value="">Choose an image...</option>
                    {imageEvidence.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.filename}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="detection-controls">
                <button
                  className="btn-run-detection"
                  onClick={() => handleRunDetection(false)}
                  disabled={runningDetection || !selectedEvidence}
                >
                  {runningDetection && (
                    <span className="loading-spinner"></span>
                  )}
                  {runningDetection ? "Analyzing..." : "Run Detection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div
          className="modal-overlay"
          onClick={() => !generatingReport && setShowReportModal(false)}
        >
          <div
            className={`modal-content report-modal-content ${reportFullscreen ? "report-modal-fullscreen" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header (unchanged) ── */}
            <div className="modal-header">
              <h3>📄 Forensic Investigation Report</h3>
              <div className="report-modal-header-actions">
                <button
                  className="modal-fullscreen-btn"
                  onClick={() => setReportFullscreen(!reportFullscreen)}
                  title={reportFullscreen ? "Minimize" : "Full Screen"}
                >
                  {reportFullscreen ? "⊡ Minimize" : "⛶ Full Screen"}
                </button>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportFullscreen(false);
                  }}
                  disabled={generatingReport}
                >
                  ×
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="modal-body">
              {/* Loading */}
              {generatingReport && (
                <div className="report-loading">
                  <div className="report-loading-spinner"></div>
                  <p>Generating forensic report using Gemini AI...</p>
                  <small>This may take up to 30 seconds</small>
                </div>
              )}

              {/* Error */}
              {reportError && !generatingReport && (
                <div className="detection-message error">{reportError}</div>
              )}

              {/* Report */}
              {reportData && !generatingReport && (
                <>
                  {/* Meta strip */}
                  <div className="report-meta">
                    <span className="report-meta-item">
                      📁 Case: {reportData.case_name}
                    </span>
                    <span className="report-meta-item">
                      🖼️ Evidence: {reportData.evidence_count}
                    </span>
                    <span className="report-meta-item">
                      🔍 Detections: {reportData.detection_count}
                    </span>
                    <span className="report-meta-item">
                      👥 Witnesses: {reportData.witness_count}
                    </span>
                    <span className="report-meta-item">
                      🕒 {new Date(reportData.generated_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="report-actions">
                    <button
                      className="btn-save-edit"
                      onClick={handleCopyReport}
                    >
                      📋 Copy Report
                    </button>
                    <button
                      className="btn-run-detection"
                      onClick={handleDownloadReport}
                    >
                      ⬇️ Download .txt
                    </button>
                  </div>

                  {/* ── Structured Renderer (replaces the old <pre>) ── */}
                  <div className="report-renderer-wrap">
                    <ForensicReportRenderer reportText={reportData.report} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
{confirmDelete && (
  <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
    <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3>Confirm Delete</h3>
        <button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button>
      </div>
      <div className="modal-body" style={{ padding: '1.5rem' }}>
        <p style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
          {confirmDelete.type === 'evidence'
            ? `Are you sure you want to delete "${confirmDelete.name}"? This will also delete any associated detection results.`
            : 'Are you sure you want to delete this detection result?'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn-cancel-edit" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button
            className="btn-run-detection"
            style={{ background: '#ef4444' }}
            onClick={async () => {
              const { type, id, name } = confirmDelete;
              setConfirmDelete(null);
              if (type === 'evidence') {
                setDeletingEvidenceId(id);
                try {
                  const response = await deleteEvidence(id);
                  if (response.ok) {
                    setMessage('✅ Evidence deleted successfully');
                    await load();
                  } else {
                    const err = await response.json();
                    setMessage('❌ Failed to delete: ' + (err.detail || 'Unknown error'));
                  }
                } catch (error) {
                  setMessage('❌ Error deleting evidence: ' + error.message);
                } finally {
                  setDeletingEvidenceId(null);
                }
              } else {
                setDeletingResultId(id);
                try {
                  const response = await deleteDetectionResult(id);
                  if (response.ok) {
                    setMessage('✅ Detection result deleted successfully');
                    await loadDetectionResults();
                  } else {
                    const err = await response.json();
                    setMessage('❌ Failed to delete: ' + (err.detail || 'Unknown error'));
                  }
                } catch (error) {
                  setMessage('❌ Error deleting result: ' + error.message);
                } finally {
                  setDeletingResultId(null);
                }
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
