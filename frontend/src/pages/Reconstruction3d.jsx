// pages/Reconstruction3D.jsx
import React, { useEffect, useState, useCallback } from "react";
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


export default function Reconstruction3D() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData]       = useState(null);
  const [images, setImages]           = useState([]);
  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [deletingJobId, setDeletingJobId] = useState(null);

  // Confirm dialog state
  const [pendingImage, setPendingImage] = useState(null);

  // Active job being polled
  const [activeJobId, setActiveJobId] = useState(null);

  // ── Load case + images + past jobs ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [caseRes, imagesRes, jobsRes] = await Promise.all([
        getCase(id),
        listCaseImages(id),
        listCaseJobs(id),
      ]);

      if (caseRes.ok) {
        const d = await caseRes.json();
        setCaseData(d.case);
      }

      if (imagesRes.ok) {
        const d = await imagesRes.json();
        setImages(d.images || []);
      }

      if (jobsRes.ok) {
        const d = await jobsRes.json();
        const sorted = (d.jobs || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setJobs(sorted);

        // Resume polling for any running job
        const running = sorted.find(
          (j) => j.status === "running" || j.status === "pending"
        );
        if (running) setActiveJobId(running.id);
      }
    } catch (err) {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await getReconstructionStatus(activeJobId);
        if (!res.ok) return;
        const { job } = await res.json();

        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? job : j))
        );

        if (job.status === "done" || job.status === "failed") {
          setActiveJobId(null);
          clearInterval(interval);
        }
      } catch (_) {}
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [activeJobId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleImageClick = (image) => {
    // Don't allow starting a new job while one is running
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
      } else {
        const d = await res.json();
        setError(d.detail || "Failed to delete job.");
      }
    } catch (err) {
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
      const res = await startReconstruction(id, image.filename, image.filepath);
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "Failed to start reconstruction.");
        return;
      }
      const { job } = await res.json();

      setJobs((prev) => [job, ...prev]);
      setActiveJobId(job.id);
    } catch (err) {
      setError("Failed to start reconstruction.");
    }
  };

  const handleCancel = () => setPendingImage(null);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getStatusColor = (status) => {
    switch (status) {
      case "done":    return "status-done";
      case "running": return "status-running";
      case "failed":  return "status-failed";
      default:        return "status-pending";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "done":    return "✓ Done";
      case "running": return "⟳ Processing";
      case "failed":  return "✗ Failed";
      default:        return "· Pending";
    }
  };

  const formatDate = (str) =>
    str ? new Date(str).toLocaleString() : "—";

  const isJobRunning = !!activeJobId;

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="r3d-container">
        <div className="r3d-loading">
          <div className="r3d-spinner" />
          <span>Loading...</span>
        </div>
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
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Image Picker */}
      <section className="r3d-section">
        <div className="r3d-section-header">
          <h2>Select an Image</h2>
          <span className="r3d-badge">{images.length} available</span>
        </div>

        {isJobRunning && (
          <div className="r3d-notice">
            A job is currently running. You can start another once it completes.
          </div>
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
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                  <div className="r3d-image-fallback" style={{ display: "none" }}>
                    🖼
                  </div>
                </div>
                <div className="r3d-image-label">
                  <span title={img.filename}>{img.filename}</span>
                </div>
                {!isJobRunning && (
                  <div className="r3d-image-overlay">
                    <span>Generate 3D →</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Jobs History */}
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

                {/* Progress bar — show while running or pending */}
                {(job.status === "running" || job.status === "pending") && (
                  <div className="r3d-progress-wrap">
                    <div className="r3d-progress-track">
                      <div
                        className="r3d-progress-fill"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="r3d-progress-pct">{job.progress}%</span>
                  </div>
                )}

                {/* Done: show download link */}
                {job.status === "done" && job.output_path && (
                  <div className="r3d-job-output">
                    <span className="r3d-output-label">Output ready:</span>
                    <a
                      href={`http://127.0.0.1:8000/3d-models/${job.output_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="r3d-download-btn"
                    >
                      ⬇ Download 3D Model
                    </a>
                  </div>
                )}

                {/* Failed: show error */}
                {job.status === "failed" && job.error_message && (
                  <div className="r3d-job-error">
                    {job.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirm Dialog */}
      {pendingImage && (
        <div className="r3d-overlay" onClick={handleCancel}>
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
              <p>
                TripoSR will generate a 3D model from:
                <br />
                <strong>{pendingImage.filename}</strong>
              </p>
              <small>This may take several minutes depending on your hardware.</small>
              <div className="r3d-dialog-actions">
                <button className="r3d-btn-confirm" onClick={handleConfirm}>
                  Yes, Generate
                </button>
                <button className="r3d-btn-cancel" onClick={handleCancel}>
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
