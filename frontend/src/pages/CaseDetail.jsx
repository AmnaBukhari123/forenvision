// pages/CaseDetail.jsx - Detection Results Below Evidence
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  getCase, 
  uploadEvidence, 
  create3d, 
  updateCase,
  runObjectDetection,
  getObjectDetectionResults,
  deleteDetectionResult,
  deleteEvidence,
  getCurrentUser,
  getModelsInfo
} from "../services/api";
import "./CaseDetail.css";

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const fileInputRef = useRef(null);
  
  const [data, setData] = useState(null);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Editable fields
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    incident_date: "",
    category: "",
    priority: "",
    client: "",
    investigating_officer: "",
    status: ""
  });
  
  // Object Detection States
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState("");
  const [selectedModel, setSelectedModel] = useState("crime_scene");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.25);
  const [runningDetection, setRunningDetection] = useState(false);
  const [detectionResults, setDetectionResults] = useState([]);
  const [detectionMessage, setDetectionMessage] = useState({ type: "", text: "" });
  const [deletingResultId, setDeletingResultId] = useState(null);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);

  const load = async () => {
    try {
      const res = await getCase(id);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        
        setEditForm({
          name: d.case.name || "",
          description: d.case.description || "",
          incident_date: d.case.incident_date ? d.case.incident_date.split('T')[0] : "",
          category: d.case.category || "",
          priority: d.case.priority || "",
          client: d.case.client || "",
          investigating_officer: d.case.investigating_officer || "",
          status: d.case.status || "New"
        });
        
        await loadDetectionResults();
      } else if (res.status === 401) {
        alert('Session expired. Please login again.');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else if (res.status === 403) {
        alert('You do not have access to this case.');
        navigate('/dashboard/cases');
      }
    } catch (error) {
      console.error('Error loading case:', error);
    }
  };

  const loadDetectionResults = async () => {
    try {
      const response = await getObjectDetectionResults(id);
      const data = await response.json();
      setDetectionResults(data.detection_results || []);
    } catch (error) {
      console.error('Error loading detection results:', error);
    }
  };

  const loadModelsInfo = async () => {
    try {
      const response = await getModelsInfo();
      const data = await response.json();
      setAvailableModels(data.available_models || []);
    } catch (error) {
      console.error('Error loading models info:', error);
    }
  };

  useEffect(() => {
    load();
    loadModelsInfo();
  }, [id]);

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };

  const handleSaveEdit = async () => {
    setUpdating(true);
    try {
      const response = await updateCase(id, editForm);

      if (response.ok) {
        setMessage("Case updated successfully");
        setIsEditing(false);
        load();
      } else {
        const errorData = await response.json();
        setMessage("Failed to update case: " + (errorData.detail || "Unknown error"));
      }
    } catch (error) {
      console.error("Update error:", error);
      setMessage("Error updating case: " + error.message);
    }
    setUpdating(false);
  };

  const handleCancelEdit = () => {
    if (data && data.case) {
      setEditForm({
        name: data.case.name || "",
        description: data.case.description || "",
        incident_date: data.case.incident_date ? data.case.incident_date.split('T')[0] : "",
        category: data.case.category || "",
        priority: data.case.priority || "",
        client: data.case.client || "",
        investigating_officer: data.case.investigating_officer || "",
        status: data.case.status || "New"
      });
    }
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
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        load();
      } else {
        setMessage("Upload failed.");
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage("Upload failed.");
    }
    setUploading(false);
  };

  const handle3d = async () => {
    try {
      const res = await create3d(id);
      if (res.ok) {
        const d = await res.json();
        setMessage(d.message);
      }
    } catch (error) {
      console.error('3D creation error:', error);
      setMessage("Error creating 3D model");
    }
  };

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
    return data.evidence.filter(ev => {
      const filename = ev.filename.toLowerCase();
      return filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/);
    });
  };

  const handleRunDetection = async (runOnAll = false) => {
    setRunningDetection(true);
    setDetectionMessage({ type: "", text: "" });

    try {
      const options = {
        modelType: selectedModel,
        confThreshold: confidenceThreshold
      };

      if (!runOnAll) {
        if (!selectedEvidence) {
          setDetectionMessage({ 
            type: "error", 
            text: "Please select an evidence file to analyze" 
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
          text: result.message || "Object detection completed successfully"
        });
        
        await loadDetectionResults();
        
        setTimeout(() => {
          setShowDetectionModal(false);
        }, 2000);
      } else {
        setDetectionMessage({ 
          type: "error", 
          text: result.detail || "Detection failed. Please try again." 
        });
      }
      
    } catch (error) {
      console.error('Object detection failed:', error);
      setDetectionMessage({ 
        type: "error", 
        text: error.message || "Object detection failed. Please try again." 
      });
    } finally {
      setRunningDetection(false);
    }
  };

  const handleDeleteDetectionResult = async (resultId) => {
    if (!window.confirm("Are you sure you want to delete this detection result?")) {
      return;
    }

    setDeletingResultId(resultId);
    try {
      const response = await deleteDetectionResult(resultId);
      
      if (response.ok) {
        setMessage("Detection result deleted successfully");
        await loadDetectionResults();
      } else {
        const errorData = await response.json();
        setMessage("Failed to delete detection result: " + (errorData.detail || "Unknown error"));
      }
    } catch (error) {
      console.error('Delete detection result error:', error);
      setMessage("Error deleting detection result: " + error.message);
    } finally {
      setDeletingResultId(null);
    }
  };

  const handleDeleteEvidence = async (evidenceId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This will also delete any associated detection results.`)) {
      return;
    }

    setDeletingEvidenceId(evidenceId);
    try {
      const response = await deleteEvidence(evidenceId);
      
      if (response.ok) {
        setMessage("Evidence deleted successfully");
        await load();
      } else {
        const errorData = await response.json();
        setMessage("Failed to delete evidence: " + (errorData.detail || "Unknown error"));
      }
    } catch (error) {
      console.error('Delete evidence error:', error);
      setMessage("Error deleting evidence: " + error.message);
    } finally {
      setDeletingEvidenceId(null);
    }
  };

  const formatConfidence = (confidence) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const getEvidenceFilename = (evidenceId) => {
    if (!data || !data.evidence) return `Evidence #${evidenceId}`;
    const evidenceItem = data.evidence.find(item => item.id === evidenceId);
    return evidenceItem ? evidenceItem.filename : `Evidence #${evidenceId}`;
  };

  const getModelName = (modelType) => {
    if (modelType === 'blood' || modelType === 'blood_detection') {
      return 'Blood Detection';
    }
    return 'Crime Scene Detection';
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
                <button 
                  className="edit-case-btn" 
                  onClick={() => setIsEditing(true)}
                >
                   Edit Case
                </button>
              </div>
              <div className="case-meta">
                <span className="case-id">Case #{caseData.id}</span>
                <span className={`status-badge large ${caseData.status?.toLowerCase() || 'new'}`}>
                  {caseData.status || 'New'}
                </span>
                {caseData.priority && (
                  <span className={`priority-badge large ${caseData.priority.toLowerCase()}`}>
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
                  disabled={updating}
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
              <span>{caseData.incident_date ? new Date(caseData.incident_date).toLocaleDateString() : "Not specified"}</span>
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
                <select name="status" value={editForm.status} onChange={handleEditChange}>
                  <option value="New">New</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Priority</label>
                <select name="priority" value={editForm.priority} onChange={handleEditChange}>
                  <option value="">Select</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Category</label>
                <select name="category" value={editForm.category} onChange={handleEditChange}>
                  <option value="">Select</option>
                  <option value="Theft">Theft</option>
                  <option value="Cybercrime">Cybercrime</option>
                  <option value="Accident Reconstruction">Accident Reconstruction</option>
                  <option value="General Investigation">General Investigation</option>
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

      {/* Description (when not editing) */}
      {!isEditing && caseData.description && (
        <section className="description-section">
          <h3>Description</h3>
          <p className="case-description">{caseData.description}</p>
        </section>
      )}

      {/* Analysis Tools Section - Now placed above evidence */}
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
              {imageEvidence.length === 0 ? 'No Images' : 'Run Detection'}
            </button>
            <small className="tool-hint">
              {imageEvidence.length} image{imageEvidence.length !== 1 ? 's' : ''} available
            </small>
          </div>
          
          <div className="analysis-tool-card">
            <div className="tool-icon">📐</div>
            <h4>3D Reconstruction</h4>
            <p>Create 3D models from evidence</p>
            <button 
              onClick={handle3d} 
              className="tool-btn secondary"
            >
              Generate 3D
            </button>
            <small className="tool-hint">Requires multiple angle images</small>
          </div>
          
          <div className="analysis-tool-card">
            <div className="tool-icon">📊</div>
            <h4>Case Analytics</h4>
            <p>Generate reports and insights</p>
            <button 
              className="tool-btn tertiary"
              onClick={() => setMessage("Analytics feature coming soon!")}
            >
              View Analytics
            </button>
            <small className="tool-hint">Coming soon</small>
          </div>
        </div>
      </section>

      {/* Status Message */}
      {message && (
        <div className="message-banner">
          {message}
        </div>
      )}

      {/* Evidence Section - Full width below analysis tools */}
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
                style={{ display: 'none' }}
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
                    {deletingEvidenceId === ev.id ? '⏳' : '×'}
                  </button>
                  
                  <div className="evidence-preview">
                    {ev.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/) ? (
                      <img 
                        src={`http://127.0.0.1:8000/uploads/${ev.filename}`} 
                        alt={ev.filename}
                        className="evidence-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="file-icon" style={{display: ev.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/) ? 'none' : 'flex'}}>
                      {ev.filename.toLowerCase().match(/\.(pdf)$/) ? '📄' : 
                       ev.filename.toLowerCase().match(/\.(mp4|avi|mov)$/) ? '🎥' : 
                       ev.filename.toLowerCase().match(/\.(doc|docx)$/) ? '📝' : '📁'}
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

      {/* Detection Results - Below Evidence */}
      {detectionResults.length > 0 && (
        <section className="detection-results-section">
          <div className="section-header">
            <h3>🔍 Detection Results</h3>
            <span className="evidence-count">{detectionResults.length} analyzed</span>
          </div>
          
          <div className="detection-results-horizontal">
            {detectionResults.map(result => {
              const detectionData = result.results;
              const detections = detectionData?.detections || [];
              const evidenceItem = data.evidence.find(ev => ev.id === result.evidence_id);
              const imagePath = evidenceItem ? `http://127.0.0.1:8000/uploads/${evidenceItem.filename}` : null;
              
              return (
                <div key={result.id} className="detection-result-horizontal-card">
                  <button 
                    className="delete-result-btn-horizontal"
                    onClick={() => handleDeleteDetectionResult(result.id)}
                    disabled={deletingResultId === result.id}
                    title="Delete detection result"
                  >
                    {deletingResultId === result.id ? '⏳' : '×'}
                  </button>
                  
                  {/* Left: Image with Bounding Boxes */}
                  <div className="detection-image-container">
                    {imagePath && (
                      <div className="detection-image-wrapper">
                        <img 
                          src={imagePath} 
                          alt={getEvidenceFilename(result.evidence_id)}
                          className="detection-result-image"
                        />
                        <svg className="detection-overlay" viewBox={`0 0 ${detectionData?.image_dimensions?.width || 640} ${detectionData?.image_dimensions?.height || 640}`}>
                          {detections.map((detection, idx) => {
                            const bbox = detection.bbox;
                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                            const color = colors[idx % colors.length];
                            
                            return (
                              <g key={idx}>
                                <rect
                                  x={bbox.x1}
                                  y={bbox.y1}
                                  width={bbox.x2 - bbox.x1}
                                  height={bbox.y2 - bbox.y1}
                                  fill="none"
                                  stroke={color}
                                  strokeWidth="3"
                                  opacity="0.8"
                                />
                                <rect
                                  x={bbox.x1}
                                  y={bbox.y1 - 25}
                                  width={(detection.class_name.length * 8) + 20}
                                  height="25"
                                  fill={color}
                                  opacity="0.9"
                                />
                                <text
                                  x={bbox.x1 + 5}
                                  y={bbox.y1 - 8}
                                  fill="white"
                                  fontSize="14"
                                  fontWeight="bold"
                                >
                                  {detection.class_name} {formatConfidence(detection.confidence)}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Right: Details and Summary */}
                  <div className="detection-details-container">
                    <div className="detection-header-row">
                      <div>
                        <h4 className="detection-title">{getEvidenceFilename(result.evidence_id)}</h4>
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
                      <div className="detection-stats-mini">
                        {detectionData?.image_dimensions && (
                          <div className="stat-mini">
                            <span className="stat-value-mini">{detectionData.image_dimensions.width}×{detectionData.image_dimensions.height}</span>
                            <span className="stat-label-mini">Resolution</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="detections-grid">
                      {detections.length > 0 ? (
                        detections.map((detection, index) => (
                          <div key={index} className="detection-chip">
                            <span className="chip-icon">🎯</span>
                            <div className="chip-content">
                              <span className="chip-label">{detection.class_name}</span>
                              <span className="chip-confidence">{formatConfidence(detection.confidence)}</span>
                            </div>
                            {detection.category && (
                              <span className="chip-category">{detection.category}</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="no-detections-horizontal">
                          <span>⚠️ No objects detected in this image</span>
                        </div>
                      )}
                    </div>
                    
                    {detectionData?.category_counts && Object.keys(detectionData.category_counts).length > 0 && (
                      <div className="category-summary">
                        <strong>Categories Found:</strong>
                        {Object.entries(detectionData.category_counts).map(([category, count]) => (
                          <span key={category} className="category-tag">
                            {category} ({count})
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="detection-timestamp">
                      📅 Analyzed: {new Date(result.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Object Detection Modal */}
      {showDetectionModal && (
        <div className="modal-overlay" onClick={() => setShowDetectionModal(false)}>
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
                  <label>Detection Model:</label>
                  <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={runningDetection}
                    className="model-select"
                  >
                    <option value="crime_scene">Crime Scene Detection (13 object types)</option>
                    <option value="blood">Blood Detection (Specialized)</option>
                  </select>
                  <small className="form-hint">
                    {selectedModel === 'blood' 
                      ? 'Specialized model for detecting blood and bloodstain evidence' 
                      : 'General model for weapons, evidence, and human elements'}
                  </small>
                </div>

                {/* <div className="form-group">
                  <label>Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%</label>
                  <input 
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    disabled={runningDetection}
                    className="threshold-slider"
                  />
                  <small className="form-hint">
                    Lower values detect more objects but may include false positives
                  </small>
                </div> */}

                <div className="form-group">
                  <label>Select Evidence to Analyze:</label>
                  <select 
                    value={selectedEvidence} 
                    onChange={(e) => setSelectedEvidence(e.target.value)}
                    disabled={runningDetection}
                    className="evidence-select"
                  >
                    <option value="">Choose an image...</option>
                    {imageEvidence.map(item => (
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
                  {runningDetection && <span className="loading-spinner"></span>}
                  {runningDetection ? "Analyzing..." : "Run Detection"}
                </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}