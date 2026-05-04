// pages/Reconstruction3D.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getCase,
  listCaseImages,
  startReconstruction,
  getReconstructionStatus,
  listCaseJobs,
  deleteReconstructionJob,
} from "../services/api";
import "./Reconstruction3D.css";

const POLL_INTERVAL = 2000;
const MODEL_VIEWER_SCRIPT = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";

// ── Load model-viewer script once ────────────────────────────────────────────
function useModelViewerScript() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (customElements.get("model-viewer")) { setReady(true); return; }
    if (document.querySelector(`script[src="${MODEL_VIEWER_SCRIPT}"]`)) {
      const existing = document.querySelector(`script[src="${MODEL_VIEWER_SCRIPT}"]`);
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const s = document.createElement("script");
    s.type  = "module";
    s.src   = MODEL_VIEWER_SCRIPT;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

// ── Model Viewer Modal ────────────────────────────────────────────────────────
function ModelViewerModal({ modelUrl, filename, onClose }) {
  const mvReady  = useModelViewerScript();
  const fileType = modelUrl.split("?")[0].split(".").pop().toUpperCase();

  return (
    <div className="r3d-viewer-overlay" onClick={onClose}>
      <div className="r3d-viewer-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="r3d-viewer-header">
          <div className="r3d-viewer-title">
            <span className="r3d-viewer-icon">⬡</span>
            <div>
              <span className="r3d-viewer-name">{filename}</span>
              <span className="r3d-viewer-fmt">.{fileType}</span>
            </div>
          </div>
          <div className="r3d-viewer-header-actions">
            <a
              href={modelUrl}
              target="_blank"
              rel="noreferrer"
              className="r3d-viewer-dl-btn"
              onClick={(e) => e.stopPropagation()}
            >
              ⬇ Download
            </a>
            <button className="r3d-viewer-close-btn" onClick={onClose} title="Close viewer">✕</button>
          </div>
        </div>

        {/* Viewer */}
        <div className="r3d-viewer-canvas-wrap">
          {!mvReady ? (
            <div className="r3d-viewer-loader">
              <div className="r3d-viewer-spinner" />
              <span>Loading viewer…</span>
            </div>
          ) : (
            // eslint-disable-next-line react/no-unknown-property
            <model-viewer
              src={modelUrl}
              alt={filename}
              auto-rotate
              camera-controls
              shadow-intensity="1"
              environment-image="neutral"
              exposure="1"
              style={{ width: "100%", height: "100%", background: "#0d1117" }}
            />
          )}
        </div>

        {/* Hint bar */}
        {mvReady && (
          <div className="r3d-viewer-hint">
            <span>🖱 Left drag · rotate</span>
            <span>Right drag · pan</span>
            <span>Scroll · zoom</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Reconstruction3D() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData]       = useState(null);
  const [images, setImages]           = useState([]);
  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [deletingJobId, setDeletingJobId] = useState(null);
  const [pendingImage, setPendingImage]   = useState(null);
  const [removeBg, setRemoveBg]           = useState(true);
  const [activeJobId, setActiveJobId]     = useState(null);
  const [viewerJob, setViewerJob]         = useState(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [caseRes, imagesRes, jobsRes] = await Promise.all([
        getCase(id),
        listCaseImages(id),
        listCaseJobs(id),
      ]);
      if (caseRes.ok)   setCaseData((await caseRes.json()).case);
      if (imagesRes.ok) setImages((await imagesRes.json()).images || []);
      if (jobsRes.ok) {
        const sorted = ((await jobsRes.json()).jobs || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setJobs(sorted);
        const running = sorted.find((j) => j.status === "running" || j.status === "pending");
        if (running) setActiveJobId(running.id);
      }
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await getReconstructionStatus(activeJobId);
        if (!res.ok) return;
        const { job } = await res.json();
        setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
        if (job.status === "done" || job.status === "failed") {
          setActiveJobId(null);
          clearInterval(interval);
        }
      } catch (_) {}
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [activeJobId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleImageClick = (image) => {
    if (activeJobId) return;
    setPendingImage(image);
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Delete this reconstruction job and its output files?")) return;
    setDeletingJobId(jobId);
    try {
      const res = await deleteReconstructionJob(jobId);
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (activeJobId === jobId) setActiveJobId(null);
        if (viewerJob?.id === jobId) setViewerJob(null);
      } else {
        setError((await res.json()).detail || "Failed to delete job.");
      }
    } catch {
      setError("Failed to delete job.");
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleConfirm = async () => {
    if (!pendingImage) return;
    const image = pendingImage;
    setPendingImage(null);
    try {
      const res = await startReconstruction(id, image.filename, image.filepath, removeBg);
      if (!res.ok) {
        setError((await res.json()).detail || "Failed to start reconstruction.");
        return;
      }
      const { job } = await res.json();
      setJobs((prev) => [job, ...prev]);
      setActiveJobId(job.id);
    } catch {
      setError("Failed to start reconstruction.");
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getStatusColor = (s) => ({ done: "status-done", running: "status-running", failed: "status-failed" }[s] || "status-pending");
  const getStatusLabel = (s) => ({ done: "✓ Done", running: "⟳ Processing", failed: "✗ Failed" }[s] || "· Pending");
  const formatDate     = (s) => s ? new Date(s).toLocaleString() : "—";
  const isJobRunning   = !!activeJobId;
  const getModelUrl    = (job) => job.output_path ? `http://127.0.0.1:8000/3d-models/${job.output_path}` : null;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="r3d-container">
        <div className="r3d-loading"><div className="r3d-spinner" /><span>Loading...</span></div>
      </div>
    );
  }

  return (
    <div className="r3d-container">

      {/* Header */}
      <div className="r3d-header">
        <button className="r3d-back-btn" onClick={() => navigate(`/dashboard/cases/${id}`)}>
          ← Back to Case
        </button>
        <div className="r3d-header-text">
          <h1>3D Reconstruction</h1>
          {caseData && <span className="r3d-case-name">Case: {caseData.name}</span>}
        </div>
      </div>

      {error && (
        <div className="r3d-error-banner">
          {error}<button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Image Picker */}
      <section className="r3d-section">
        <div className="r3d-section-header">
          <h2>Select an Image</h2>
          <span className="r3d-badge">{images.length} available</span>
        </div>

        {isJobRunning && (
          <div className="r3d-notice">A job is currently running. You can start another once it completes.</div>
        )}

        {images.length === 0 ? (
          <div className="r3d-empty">
            <div className="r3d-empty-icon">📂</div>
            <p>No image evidence found for this case.</p>
            <small>Upload images from the case detail page first.</small>
          </div>
        ) : (
          <div className="r3d-image-grid">
            {images.map((img) => (
              <button
                key={img.filepath}
                className={`r3d-image-card ${isJobRunning ? "r3d-image-card--disabled" : ""}`}
                onClick={() => handleImageClick(img)}
                disabled={isJobRunning}
                title={isJobRunning ? "Wait for current job to finish" : `Generate 3D for ${img.filename}`}
              >
                <div className="r3d-image-preview">
                  <img
                    src={`http://127.0.0.1:8000/uploads/${img.filename}`}
                    alt={img.filename}
                    onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                  />
                  <div className="r3d-image-fallback" style={{ display: "none" }}>🖼</div>
                </div>
                <div className="r3d-image-label"><span title={img.filename}>{img.filename}</span></div>
                {!isJobRunning && <div className="r3d-image-overlay"><span>Generate 3D →</span></div>}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Jobs */}
      {jobs.length > 0 && (
        <section className="r3d-section">
          <div className="r3d-section-header">
            <h2>Reconstruction Jobs</h2>
            <span className="r3d-badge">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="r3d-jobs-list">
            {jobs.map((job) => (
              <div key={job.id} className={`r3d-job-card ${getStatusColor(job.status)}`}>

                <div className="r3d-job-top">
                  <div className="r3d-job-info">
                    <span className="r3d-job-filename">{job.image_filename}</span>
                    <span className={`r3d-job-status ${getStatusColor(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                  </div>
                  <div className="r3d-job-top-right">
                    <span className="r3d-job-date">{formatDate(job.created_at)}</span>
                    <button
                      className="r3d-delete-job-btn"
                      onClick={() => handleDeleteJob(job.id)}
                      disabled={deletingJobId === job.id || job.status === "running"}
                      title={job.status === "running" ? "Cannot delete a running job" : "Delete this job"}
                    >
                      {deletingJobId === job.id ? "⏳" : "×"}
                    </button>
                  </div>
                </div>

                {(job.status === "running" || job.status === "pending") && (
                  <div className="r3d-progress-wrap">
                    <div className="r3d-progress-track">
                      <div className="r3d-progress-fill" style={{ width: `${job.progress}%` }} />
                    </div>
                    <span className="r3d-progress-pct">{job.progress}%</span>
                  </div>
                )}

                {job.status === "done" && job.output_path && (
                  <div className="r3d-job-output">
                    <span className="r3d-output-label">Output ready:</span>
                    <div className="r3d-job-output-actions">
                      <button className="r3d-view-btn" onClick={() => setViewerJob(job)}>
                        ⬡ View 3D Model
                      </button>
                      <a href={getModelUrl(job).replace('.glb', '.obj')} target="_blank" rel="noreferrer" className="r3d-download-btn">
                        ⬇ Download .obj
                      </a>
                    </div>
                  </div>
                )}

                {job.status === "failed" && job.error_message && (
                  <div className="r3d-job-error">{job.error_message}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirm Dialog */}
      {pendingImage && (
        <div className="r3d-overlay" onClick={() => setPendingImage(null)}>
          <div className="r3d-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="r3d-dialog-preview">
              <img
                src={`http://127.0.0.1:8000/uploads/${pendingImage.filename}`}
                alt={pendingImage.filename}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
            <div className="r3d-dialog-body">
              <h3>Generate 3D Model?</h3>
              <p>TripoSR will generate a 3D model from:<br /><strong>{pendingImage.filename}</strong></p>
              <label className="r3d-toggle-row" onClick={() => setRemoveBg(v => !v)}>
                <span className={`r3d-toggle ${removeBg ? "r3d-toggle--on" : ""}`}>
                  <span className="r3d-toggle-knob" />
                </span>
                <span className="r3d-toggle-label">
                  Auto-remove background
                  <small>Recommended for real photos — isolates the subject before reconstruction</small>
                </span>
              </label>
              <div className="r3d-dialog-actions">
                <button className="r3d-btn-confirm" onClick={handleConfirm}>Yes, Generate</button>
                <button className="r3d-btn-cancel" onClick={() => setPendingImage(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3D Viewer */}
      {viewerJob && (
        <ModelViewerModal
          modelUrl={getModelUrl(viewerJob)}
          filename={viewerJob.image_filename}
          onClose={() => setViewerJob(null)}
        />
      )}
    </div>
  );
}