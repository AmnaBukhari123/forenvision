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

// ── Model Viewer Modal ────────────────────────────────────────────────────────
function ModelViewerModal({ modelUrl, filename, onClose }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(null);
  const controlsRef = useRef({
    isDragging: false,
    isRightDrag: false,
    lastX: 0,
    lastY: 0,
    rotX: 0,
    rotY: 0,
    panX: 0,
    panY: 0,
    zoom: 5,
  });
  const [loadState, setLoadState] = useState("loading"); // loading | error | done
  const [loadMsg, setLoadMsg] = useState("Initialising renderer…");
  const [fileType, setFileType] = useState(null);

  useEffect(() => {
    const ext = modelUrl.split("?")[0].split(".").pop().toLowerCase();
    setFileType(ext);

    let cancelled = false;
    let ro = null;

    async function init() {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        if (cancelled) return;

        setLoadMsg("Loading 3D model…");

        const THREE = window.THREE;
        const container = containerRef.current;
        if (!container) return;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d1117);
        sceneRef.current = scene;

        // Grid
        const grid = new THREE.GridHelper(10, 20, 0x1e3a5f, 0x1e293b);
        grid.position.y = -1.5;
        scene.add(grid);

        // Lights — use flat, strong ambient so vertex colors read true
        scene.add(new THREE.AmbientLight(0xffffff, 3.0));
        const dir1 = new THREE.DirectionalLight(0xffffff, 2.0);
        dir1.position.set(5, 10, 5);
        scene.add(dir1);
        const dir2 = new THREE.DirectionalLight(0xffffff, 1.5);
        dir2.position.set(-5, 2, -5);
        scene.add(dir2);
        const dir3 = new THREE.DirectionalLight(0xffffff, 1.0);
        dir3.position.set(0, -5, 0);
        scene.add(dir3);

        // Camera
        const camera = new THREE.PerspectiveCamera(
          45,
          container.clientWidth / container.clientHeight,
          0.01,
          1000
        );
        camera.position.set(0, 1, 5);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.4;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // ── Non-passive wheel listener (fix for passive event warning) ──────
        const wheelHandler = (e) => {
          e.preventDefault();
          controlsRef.current.zoom = Math.max(
            0.5,
            Math.min(20, controlsRef.current.zoom + e.deltaY * 0.01)
          );
        };
        renderer.domElement.addEventListener("wheel", wheelHandler, { passive: false });

        // Load model
        if (ext === "glb" || ext === "gltf") {
          await loadScript(
            "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"
          );
          if (cancelled) return;
          const loader = new THREE.GLTFLoader();
          await new Promise((res, rej) => {
            loader.load(modelUrl, (gltf) => {
              if (cancelled) return;
              fitModelToView(gltf.scene, scene, camera, THREE);
              scene.add(gltf.scene);
              res();
            }, undefined, rej);
          });

        } else if (ext === "obj") {
          // TripoSR stores color as per-vertex colors by default — there is no .mtl file
          // unless --bake-texture was used. OBJLoader parses vertex colors into
          // geometry.attributes.color automatically, but MeshStandardMaterial ignores
          // them unless vertexColors: true is explicitly set.
          await loadScript(
            "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js"
          );
          if (cancelled) return;
          setLoadMsg("Loading geometry…");

          await new Promise((res, rej) => {
            new THREE.OBJLoader().load(modelUrl, (obj) => {
              if (cancelled) return;
              obj.traverse((child) => {
                if (child.isMesh) {
                  const hasVC = child.geometry.attributes.color !== undefined;
                  // MeshBasicMaterial ignores lighting and renders vertex colors
                  // at full brightness — exactly what we want for TripoSR output.
                  // Fall back to MeshStandardMaterial (lit) only when no vertex colors.
                  child.material = hasVC
                    ? new THREE.MeshBasicMaterial({ vertexColors: true })
                    : new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6, metalness: 0.05 });
                }
              });
              fitModelToView(obj, scene, camera, THREE);
              scene.add(obj);
              res();
            }, undefined, rej);
          });

        } else {
          setLoadState("error");
          setLoadMsg(`Unsupported format: .${ext}. Download the file to view it.`);
          return;
        }

        if (cancelled) return;
        setLoadState("done");

        // Resize observer
        ro = new ResizeObserver(() => {
          if (!container || !renderer || !camera) return;
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight);
        });
        ro.observe(container);

        // Animate
        const ctrl = controlsRef.current;
        function animate() {
          frameRef.current = requestAnimationFrame(animate);
          if (!ctrl.isDragging) ctrl.rotY += 0.005;
          camera.position.x = ctrl.panX + ctrl.zoom * Math.sin(ctrl.rotY) * Math.cos(ctrl.rotX);
          camera.position.y = ctrl.panY + ctrl.zoom * Math.sin(ctrl.rotX);
          camera.position.z = ctrl.zoom * Math.cos(ctrl.rotY) * Math.cos(ctrl.rotX);
          camera.lookAt(ctrl.panX, ctrl.panY, 0);
          renderer.render(scene, camera);
        }
        animate();

      } catch (err) {
        if (!cancelled) {
          setLoadState("error");
          setLoadMsg("Failed to load model: " + (err.message || "unknown error"));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement?.remove();
        rendererRef.current = null;
      }
    };
  }, [modelUrl]);

  // Mouse / touch controls
  const handleMouseDown = (e) => {
    e.preventDefault();
    const ctrl = controlsRef.current;
    ctrl.isDragging = true;
    ctrl.isRightDrag = e.button === 2;
    ctrl.lastX = e.clientX;
    ctrl.lastY = e.clientY;
  };

  const handleMouseMove = (e) => {
    const ctrl = controlsRef.current;
    if (!ctrl.isDragging) return;
    const dx = e.clientX - ctrl.lastX;
    const dy = e.clientY - ctrl.lastY;
    ctrl.lastX = e.clientX;
    ctrl.lastY = e.clientY;
    if (ctrl.isRightDrag) {
      ctrl.panX -= dx * 0.005;
      ctrl.panY += dy * 0.005;
    } else {
      ctrl.rotY += dx * 0.01;
      ctrl.rotX += dy * 0.01;
      ctrl.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ctrl.rotX));
    }
  };

  const handleMouseUp = () => {
    controlsRef.current.isDragging = false;
  };

  const handleResetCamera = () => {
    const ctrl = controlsRef.current;
    ctrl.rotX = 0;
    ctrl.rotY = 0;
    ctrl.panX = 0;
    ctrl.panY = 0;
    ctrl.zoom = 5;
    ctrl.isDragging = false;
  };

  return (
    <div className="r3d-viewer-overlay" onClick={onClose}>
      <div className="r3d-viewer-modal" onClick={(e) => e.stopPropagation()}>
        {/* Viewer Header */}
        <div className="r3d-viewer-header">
          <div className="r3d-viewer-title">
            <span className="r3d-viewer-icon">⬡</span>
            <div>
              <span className="r3d-viewer-name">{filename}</span>
              {fileType && <span className="r3d-viewer-fmt">.{fileType.toUpperCase()}</span>}
            </div>
          </div>
          <div className="r3d-viewer-header-actions">
            <button className="r3d-viewer-reset-btn" onClick={handleResetCamera} title="Reset camera">
              ⟳ Reset
            </button>
            <a
              href={modelUrl}
              target="_blank"
              rel="noreferrer"
              className="r3d-viewer-dl-btn"
              onClick={(e) => e.stopPropagation()}
            >
              ⬇ Download
            </a>
            <button className="r3d-viewer-close-btn" onClick={onClose} title="Close viewer">
              ✕
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div
          className="r3d-viewer-canvas-wrap"
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {loadState === "loading" && (
            <div className="r3d-viewer-loader">
              <div className="r3d-viewer-spinner" />
              <span>{loadMsg}</span>
            </div>
          )}
          {loadState === "error" && (
            <div className="r3d-viewer-loader r3d-viewer-loader--error">
              <span className="r3d-viewer-err-icon">⚠</span>
              <span>{loadMsg}</span>
              <a href={modelUrl} target="_blank" rel="noreferrer" className="r3d-download-btn" style={{ marginTop: 12 }}>
                ⬇ Download Instead
              </a>
            </div>
          )}
        </div>

        {/* Controls hint */}
        {loadState === "done" && (
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

function fitModelToView(object, scene, camera, THREE) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2 / maxDim;
  object.scale.setScalar(scale);
  object.position.sub(center.multiplyScalar(scale));
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Reconstruction3D() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [images, setImages] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingJobId, setDeletingJobId] = useState(null);

  const [pendingImage, setPendingImage] = useState(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [activeJobId, setActiveJobId] = useState(null);

  // Viewer state
  const [viewerJob, setViewerJob] = useState(null); // job whose model to view

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [caseRes, imagesRes, jobsRes] = await Promise.all([
        getCase(id),
        listCaseImages(id),
        listCaseJobs(id),
      ]);
      if (caseRes.ok) setCaseData((await caseRes.json()).case);
      if (imagesRes.ok) setImages((await imagesRes.json()).images || []);
      if (jobsRes.ok) {
        const sorted = ((await jobsRes.json()).jobs || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setJobs(sorted);
        const running = sorted.find(
          (j) => j.status === "running" || j.status === "pending"
        );
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
  const getStatusColor = (status) => ({ done: "status-done", running: "status-running", failed: "status-failed" }[status] || "status-pending");
  const getStatusLabel = (status) => ({ done: "✓ Done", running: "⟳ Processing", failed: "✗ Failed" }[status] || "· Pending");
  const formatDate = (str) => str ? new Date(str).toLocaleString() : "—";
  const isJobRunning = !!activeJobId;

  const getModelUrl = (job) =>
    job.output_path ? `http://127.0.0.1:8000/3d-models/${job.output_path}` : null;

  // ── Render ────────────────────────────────────────────────────────────────
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
                  <div className="r3d-image-fallback" style={{ display: "none" }}>🖼</div>
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

                {/* Progress bar */}
                {(job.status === "running" || job.status === "pending") && (
                  <div className="r3d-progress-wrap">
                    <div className="r3d-progress-track">
                      <div className="r3d-progress-fill" style={{ width: `${job.progress}%` }} />
                    </div>
                    <span className="r3d-progress-pct">{job.progress}%</span>
                  </div>
                )}

                {/* Done: view + download */}
                {job.status === "done" && job.output_path && (
                  <div className="r3d-job-output">
                    <span className="r3d-output-label">Output ready:</span>
                    <div className="r3d-job-output-actions">
                      <button
                        className="r3d-view-btn"
                        onClick={() => setViewerJob(job)}
                        title="Open inline 3D viewer"
                      >
                        ⬡ View 3D Model
                      </button>
                      <a
                        href={getModelUrl(job)}
                        target="_blank"
                        rel="noreferrer"
                        className="r3d-download-btn"
                      >
                        ⬇ Download
                      </a>
                    </div>
                  </div>
                )}

                {/* Failed */}
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
              <p>
                TripoSR will generate a 3D model from:
                <br />
                <strong>{pendingImage.filename}</strong>
              </p>
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

      {/* 3D Model Viewer */}
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