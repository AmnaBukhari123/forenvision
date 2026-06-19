// pages/CaseAnalytics.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getCase,
  getObjectDetectionResults,
  deleteDetectionResult,
  getCurrentUser,
  BASE,
} from "../services/api";
import "./CaseAnalytics.css";

export default function CaseAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [caseData, setCaseData] = useState(null);
  const [detectionResults, setDetectionResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deletingResultId, setDeletingResultId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "results"
  const [expandedResult, setExpandedResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [caseRes, detectRes] = await Promise.all([
        getCase(id),
        getObjectDetectionResults(id),
      ]);

      if (caseRes.ok) {
        const d = await caseRes.json();
        setCaseData(d.case);
      } else if (caseRes.status === 403) {
        navigate("/dashboard/cases");
        return;
      }

      const detectData = await detectRes.json();
      setDetectionResults(detectData.detection_results || []);
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  // ── Computed Statistics ──────────────────────────────────────────────────
  const computeStats = () => {
    if (!detectionResults.length) return null;

    const allDetections = [];
    const categoryMap = {};
    const objectMap = {};
    const imageDetectionCounts = [];
    let highConf = 0, medConf = 0, lowConf = 0;

    detectionResults.forEach((result) => {
      const detections = result.results?.detections || [];
      imageDetectionCounts.push({
        filename: result.evidence_filename || `Evidence #${result.evidence_id}`,
        count: detections.length,
        resultId: result.id,
      });

      detections.forEach((d) => {
        allDetections.push(d);
        const conf = d.confidence;
        if (conf >= 0.75) highConf++;
        else if (conf >= 0.5) medConf++;
        else lowConf++;

        const cat = d.category || "Uncategorized";
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;

        const obj = d.class_name || "Unknown";
        if (!objectMap[obj]) objectMap[obj] = { count: 0, maxConf: 0, category: cat };
        objectMap[obj].count++;
        objectMap[obj].maxConf = Math.max(objectMap[obj].maxConf, conf);
      });
    });

    const topDetections = Object.entries(objectMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.maxConf - a.maxConf)
      .slice(0, 5);

    const mostEvidenceRich = [...imageDetectionCounts]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Identify critical findings (weapons & human remains)
    const criticalCategories = ["Weapons - Firearms", "Weapons - Melee", "Human"];
    const criticalFindings = allDetections
      .filter((d) => criticalCategories.includes(d.category) && d.confidence >= 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6);

    return {
      totalDetections: allDetections.length,
      totalImagesAnalyzed: detectionResults.length,
      categoryMap,
      topDetections,
      mostEvidenceRich,
      criticalFindings,
      confBreakdown: { high: highConf, medium: medConf, low: lowConf },
    };
  };

  const stats = computeStats();

  const formatConfidence = (c) => `${(c * 100).toFixed(1)}%`;

  const getConfidenceClass = (c) => {
    if (c >= 0.75) return "conf-high";
    if (c >= 0.5) return "conf-medium";
    return "conf-low";
  };

  const getCategoryColor = (cat) => {
    const map = {
      "Weapons - Firearms": "#ef4444",
      "Weapons - Melee": "#f97316",
      "Human": "#8b5cf6",
      "Blood Evidence": "#dc2626",
      "Evidence": "#3b82f6",
      "Uncategorized": "#6b7280",
    };
    return map[cat] || "#6b7280";
  };

  const getEvidenceFilename = (evidenceId) => {
    const r = detectionResults.find((x) => x.evidence_id === evidenceId);
    return r?.evidence_filename || `Evidence #${evidenceId}`;
  };

  const handleDeleteResult = (resultId) => {
    setConfirmDelete({ id: resultId });
  };

  const confirmDeleteResult = async () => {
    const { id: resultId } = confirmDelete;
    setConfirmDelete(null);
    setDeletingResultId(resultId);
    try {
      const response = await deleteDetectionResult(resultId);
      if (response.ok) {
        setMessage("✅ Detection result deleted");
        await load();
      } else {
        const err = await response.json();
        setMessage("❌ " + (err.detail || "Delete failed"));
      }
    } catch (err) {
      setMessage("❌ Error: " + err.message);
    } finally {
      setDeletingResultId(null);
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="analytics-spinner" />
        <p>Loading detection analytics...</p>
      </div>
    );
  }

  // ── Category Chart Bar ───────────────────────────────────────────────────
  const CategoryBar = ({ category, count, total }) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    const color = getCategoryColor(category);
    return (
      <div className="cat-bar-row">
        <div className="cat-bar-label">
          <span className="cat-dot" style={{ background: color }} />
          <span className="cat-name">{category}</span>
          <span className="cat-count">{count}</span>
        </div>
        <div className="cat-bar-track">
          <div
            className="cat-bar-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    );
  };

  // ── Confidence Donut (CSS only) ──────────────────────────────────────────
  const ConfidenceDonut = ({ high, medium, low }) => {
    const total = high + medium + low || 1;
    const highPct = (high / total) * 100;
    const medPct = (medium / total) * 100;
    const lowPct = (low / total) * 100;

    // Build conic-gradient segments
    const gradient = `conic-gradient(
      #10b981 0% ${highPct}%,
      #f59e0b ${highPct}% ${highPct + medPct}%,
      #ef4444 ${highPct + medPct}% 100%
    )`;

    return (
      <div className="donut-wrap">
        <div className="donut" style={{ background: gradient }}>
          <div className="donut-hole">
            <span className="donut-total">{total}</span>
            <span className="donut-label">total</span>
          </div>
        </div>
        <div className="donut-legend">
          <div className="donut-legend-item">
            <span className="donut-dot high" />
            <span>High ≥75%</span>
            <strong>{high}</strong>
          </div>
          <div className="donut-legend-item">
            <span className="donut-dot medium" />
            <span>Medium 50–74%</span>
            <strong>{medium}</strong>
          </div>
          <div className="donut-legend-item">
            <span className="donut-dot low" />
            <span>Low &lt;50%</span>
            <strong>{low}</strong>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-container">
      {/* ── Top Bar ── */}
      <div className="analytics-topbar">
        <button className="analytics-back-btn" onClick={() => navigate(`/dashboard/cases/${id}`)}>
          ← Back to Case
        </button>
        <div className="analytics-title-wrap">
          <h1 className="analytics-title">Detection Analytics</h1>
          {caseData && (
            <span className="analytics-case-name">
              Case #{id} — {caseData.name}
            </span>
          )}
        </div>
        <div className="analytics-tabs">
          <button
            className={`analytics-tab ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            📊 Dashboard
          </button>
          <button
            className={`analytics-tab ${activeTab === "results" ? "active" : ""}`}
            onClick={() => setActiveTab("results")}
          >
            🔍 All Results
            {detectionResults.length > 0 && (
              <span className="tab-badge">{detectionResults.length}</span>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className="analytics-message">{message}</div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  TAB: DASHBOARD                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "dashboard" && (
        <div className="dashboard-tab">
          {!stats ? (
            <div className="analytics-empty">
              <div className="analytics-empty-icon">🔍</div>
              <h3>No detection results yet</h3>
              <p>Run object detection on evidence images from the case page to see analytics here.</p>
              <button
                className="analytics-action-btn"
                onClick={() => navigate(`/dashboard/cases/${id}`)}
              >
                Go to Case
              </button>
            </div>
          ) : (
            <>
              {/* ── KPI Strip ── */}
              <div className="kpi-strip">
                <div className="kpi-card">
                  <span className="kpi-value">{stats.totalImagesAnalyzed}</span>
                  <span className="kpi-label">Images Analyzed</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-value">{stats.totalDetections}</span>
                  <span className="kpi-label">Total Detections</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-value">
                    {Object.keys(stats.categoryMap).length}
                  </span>
                  <span className="kpi-label">Categories Found</span>
                </div>
                <div className="kpi-card highlight">
                  <span className="kpi-value">{stats.confBreakdown.high}</span>
                  <span className="kpi-label">High-Confidence</span>
                </div>
              </div>

              {/* ── Main Grid ── */}
              <div className="dashboard-grid">
                {/* Category Breakdown */}
                <div className="dash-card wide">
                  <div className="dash-card-header">
                    <h3>Evidence Category Breakdown</h3>
                    <span className="dash-card-sub">
                      Across all {stats.totalImagesAnalyzed} analyzed images
                    </span>
                  </div>
                  <div className="cat-bars">
                    {Object.entries(stats.categoryMap)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count]) => (
                        <CategoryBar
                          key={cat}
                          category={cat}
                          count={count}
                          total={stats.totalDetections}
                        />
                      ))}
                  </div>
                </div>

                {/* Confidence Distribution */}
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3>Confidence Distribution</h3>
                    <span className="dash-card-sub">Detection reliability tiers</span>
                  </div>
                  <ConfidenceDonut
                    high={stats.confBreakdown.high}
                    medium={stats.confBreakdown.medium}
                    low={stats.confBreakdown.low}
                  />
                </div>

                {/* Critical Findings */}
                {stats.criticalFindings.length > 0 && (
                  <div className="dash-card wide critical-card">
                    <div className="dash-card-header">
                      <h3>⚠️ Critical Findings</h3>
                      <span className="dash-card-sub">
                        Weapons &amp; human presence — confidence ≥50%
                      </span>
                    </div>
                    <div className="critical-grid">
                      {stats.criticalFindings.map((d, i) => (
                        <div key={i} className="critical-item">
                          <span
                            className="critical-dot"
                            style={{ background: getCategoryColor(d.category) }}
                          />
                          <div className="critical-info">
                            <span className="critical-name">{d.class_name}</span>
                            <span className="critical-cat">{d.category}</span>
                          </div>
                          <span
                            className={`critical-conf ${getConfidenceClass(d.confidence)}`}
                          >
                            {formatConfidence(d.confidence)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Objects by Confidence */}
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3>Top Detected Objects</h3>
                    <span className="dash-card-sub">Ranked by peak confidence</span>
                  </div>
                  <div className="top-objects">
                    {stats.topDetections.map((obj, i) => (
                      <div key={obj.name} className="top-obj-row">
                        <span className="top-obj-rank">#{i + 1}</span>
                        <div className="top-obj-info">
                          <span className="top-obj-name">{obj.name}</span>
                          <span
                            className="top-obj-cat"
                            style={{ color: getCategoryColor(obj.category) }}
                          >
                            {obj.category}
                          </span>
                        </div>
                        <div className="top-obj-right">
                          <span
                            className={`top-obj-conf ${getConfidenceClass(obj.maxConf)}`}
                          >
                            {formatConfidence(obj.maxConf)}
                          </span>
                          <span className="top-obj-times">
                            ×{obj.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Evidence-Rich Images */}
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3>Evidence-Rich Images</h3>
                    <span className="dash-card-sub">Images with most detections</span>
                  </div>
                  <div className="rich-images">
                    {stats.mostEvidenceRich.map((img, i) => (
                      <div key={img.resultId} className="rich-img-row">
                        <div className="rich-img-rank-wrap">
                          <span className="rich-img-rank">{i + 1}</span>
                        </div>
                        <div className="rich-img-info">
                          <span
                            className="rich-img-name"
                            title={img.filename}
                          >
                            {img.filename.length > 35
                              ? img.filename.slice(0, 35) + "…"
                              : img.filename}
                          </span>
                          <span className="rich-img-bar-wrap">
                            <span
                              className="rich-img-bar"
                              style={{
                                width: `${Math.min(100, (img.count / (stats.mostEvidenceRich[0]?.count || 1)) * 100)}%`,
                              }}
                            />
                          </span>
                        </div>
                        <span className="rich-img-count">
                          {img.count} obj{img.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                    {stats.mostEvidenceRich.length === 0 && (
                      <p className="no-data-hint">No detections recorded yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Investigator Note */}
              <div className="analytics-disclaimer">
                ⚠️ AI detection findings must be verified by a trained forensic investigator.
                Confidence scores indicate model certainty, not forensic confirmation.
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  TAB: ALL RESULTS                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "results" && (
        <div className="results-tab">
          {detectionResults.length === 0 ? (
            <div className="analytics-empty">
              <div className="analytics-empty-icon">📂</div>
              <h3>No detection results</h3>
              <p>Run object detection from the case page to see results here.</p>
              <button
                className="analytics-action-btn"
                onClick={() => navigate(`/dashboard/cases/${id}`)}
              >
                Go to Case
              </button>
            </div>
          ) : (
            <div className="results-list">
              {detectionResults.map((result) => {
                const detections = result.results?.detections || [];
                const dims = result.results?.image_dimensions;
                const isExpanded = expandedResult === result.id;
                const imagePath = result.evidence_filename
                  ? `${BASE}/uploads/${result.evidence_filename}`
                  : null;

                return (
                  <div key={result.id} className={`result-card ${isExpanded ? "expanded" : ""}`}>
                    {/* Card Header Row */}
                    <div
                      className="result-card-header"
                      onClick={() =>
                        setExpandedResult(isExpanded ? null : result.id)
                      }
                    >
                      <div className="result-card-left">
                        <span className="result-expand-icon">
                          {isExpanded ? "▾" : "▸"}
                        </span>
                        <div className="result-card-title-wrap">
                          <span className="result-card-title">
                            {result.evidence_filename || `Evidence #${result.evidence_id}`}
                          </span>
                          <div className="result-card-meta">
                            <span className="result-model-badge">
                              {result.model_type === "blood"
                                ? "Blood Detection"
                                : "Crime Scene Detection"}
                            </span>
                            <span className="result-obj-count">
                              {detections.length} object
                              {detections.length !== 1 ? "s" : ""} detected
                            </span>
                            {dims && (
                              <span className="result-dims">
                                {dims.width}×{dims.height}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="result-card-right">
                        <span className="result-timestamp">
                          {new Date(result.created_at).toLocaleString()}
                        </span>
                        <button
                          className="result-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteResult(result.id);
                          }}
                          disabled={deletingResultId === result.id}
                          title="Delete result"
                        >
                          {deletingResultId === result.id ? "⏳" : "×"}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="result-card-body">
                        <div className="result-body-grid">
                          {/* Image with SVG bounding boxes */}
                          {imagePath && (
                            <div className="result-img-wrap">
                              <div
                                style={{
                                  position: "relative",
                                  display: "inline-block",
                                  lineHeight: 0,
                                  width: "100%",
                                }}
                              >
                                <img
                                  src={imagePath}
                                  alt={result.evidence_filename}
                                  className="result-img"
                                />
                                {(() => {
                                  const imgW = dims?.width || 640;
                                  const imgH = dims?.height || 640;
                                  const colors = [
                                    "#3b82f6", "#10b981", "#f59e0b",
                                    "#ef4444", "#8b5cf6", "#ec4899",
                                  ];
                                  return (
                                    <svg
                                      viewBox={`0 0 ${imgW} ${imgH}`}
                                      preserveAspectRatio="xMidYMid meet"
                                      style={{
                                        position: "absolute",
                                        top: 0, left: 0,
                                        width: "100%", height: "100%",
                                        pointerEvents: "none",
                                      }}
                                    >
                                      {detections.map((d, idx) => {
                                        const { bbox } = d;
                                        const color = colors[idx % colors.length];
                                        const fs = Math.max(imgW, imgH) * 0.022;
                                        const lh = fs * 1.6;
                                        const lw = (d.class_name.length + 6) * fs * 0.65;
                                        const ly = bbox.y1 >= lh ? bbox.y1 - lh : bbox.y1 + lh;
                                        const ty = bbox.y1 >= lh ? bbox.y1 - lh * 0.25 : bbox.y1 + lh * 0.85;
                                        return (
                                          <g key={idx}>
                                            <rect
                                              x={bbox.x1} y={bbox.y1}
                                              width={bbox.x2 - bbox.x1}
                                              height={bbox.y2 - bbox.y1}
                                              fill="none" stroke={color}
                                              strokeWidth={Math.max(imgW, imgH) * 0.004}
                                              opacity="0.9"
                                            />
                                            <rect
                                              x={bbox.x1} y={ly}
                                              width={lw} height={lh}
                                              fill={color} opacity="0.9" rx={fs * 0.2}
                                            />
                                            <text
                                              x={bbox.x1 + fs * 0.3} y={ty}
                                              fill="white" fontSize={fs} fontWeight="bold"
                                            >
                                              {d.class_name} {formatConfidence(d.confidence)}
                                            </text>
                                          </g>
                                        );
                                      })}
                                    </svg>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Detection chips */}
                          <div className="result-detections-panel">
                            {detections.length === 0 ? (
                              <div className="no-detections-msg">
                                ⚠️ No objects detected in this image
                              </div>
                            ) : (
                              <>
                                <h4 className="result-panel-title">Detected Objects</h4>
                                <div className="result-chips">
                                  {detections.map((d, i) => (
                                    <div key={i} className="result-chip">
                                      <span
                                        className="chip-color-dot"
                                        style={{
                                          background: [
                                            "#3b82f6","#10b981","#f59e0b",
                                            "#ef4444","#8b5cf6","#ec4899",
                                          ][i % 6],
                                        }}
                                      />
                                      <div className="chip-text">
                                        <span className="chip-cls">{d.class_name}</span>
                                        <span
                                          className={`chip-conf ${getConfidenceClass(d.confidence)}`}
                                        >
                                          {formatConfidence(d.confidence)}
                                        </span>
                                      </div>
                                      {d.category && (
                                        <span className="chip-cat">{d.category}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Category summary */}
                                {result.results?.category_counts &&
                                  Object.keys(result.results.category_counts).length > 0 && (
                                    <div className="result-cat-summary">
                                      <strong>Categories:</strong>
                                      {Object.entries(result.results.category_counts).map(
                                        ([cat, count]) => (
                                          <span key={cat} className="result-cat-tag">
                                            {cat} ({count})
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className="analytics-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Detection Result?</h3>
            <p>This action cannot be undone.</p>
            <div className="analytics-modal-actions">
              <button
                className="modal-cancel-btn"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button className="modal-delete-btn" onClick={confirmDeleteResult}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}