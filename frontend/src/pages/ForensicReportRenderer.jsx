//ForensicReportRenderer.jsx
import React, { useMemo } from "react";
import "./ForensicReportRenderer.css";

// ─── Parser ──────────────────────────────────────────────────────────────────

function parseReport(rawText) {
  if (!rawText) return null;

  const sectionDefs = [
    { label: "EXECUTIVE SUMMARY",         key: "executive" },
    { label: "CASE DETAILS",              key: "caseDetails" },
    { label: "EVIDENCE INVENTORY",        key: "evidence" },
    { label: "AI DETECTION ANALYSIS",     key: "detection" },
    { label: "SCENE INTERPRETATION",      key: "scene" },
    { label: "WITNESS TESTIMONY SUMMARY", key: "witness" },
    { label: "3D RECONSTRUCTION STATUS",  key: "reconstruction" },
    { label: "INVESTIGATOR NOTES",        key: "notes" },
    { label: "AI-ASSISTED CONCLUSIONS",   key: "conclusions" },
  ];

  const sections = {};
  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (currentKey) sections[currentKey] = buffer.join("\n").trim();
  };

  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "FORENSIC INVESTIGATION REPORT") continue;
    if (/^-+$/.test(trimmed)) continue;

    let matched = false;
    for (const { label, key } of sectionDefs) {
      if (trimmed.includes(label)) {
        flush();
        currentKey = key;
        buffer = [];
        matched = true;
        break;
      }
    }
    if (!matched && currentKey) buffer.push(line);
  }
  flush();
  return sections;
}

function parseCaseDetails(text) {
  if (!text) return [];
  const rows = [];
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const label = line.slice(0, idx).replace(/^[\d.\s*\-#]+/, "").trim();
    const value = line.slice(idx + 1).trim();
    if (label && value) rows.push({ label, value });
  }
  return rows;
}

// Known detectable object classes (matches the ONNX model classes)
const KNOWN_CLASSES = [
  "Blood", "Finger-print", "Fingerprint", "Glass", "Hammer",
  "Handgun", "Person", "Knife", "Shotgun", "Weapon", "Bullet",
  "Shell", "Casing", "Body", "Victim"
];

// Extract object+confidence pairs from ANY text using regex
// Handles patterns like: "Knife" (77.7%), "Blood" with 67.0% confidence, Blood: 67.0%
function extractDetectionsFromText(text) {
  if (!text) return [];
  const found = [];
  const seen = new Set();

  // Pattern 1: "ObjectName" (XX.X%) or "ObjectName" with XX.X% confidence
  const p1 = /"([^"]+)"\s*(?:with\s+)?(?:a\s+)?(?:confidence\s+(?:level\s+)?(?:of\s+)?)?(?:\()?([0-9]+(?:\.[0-9]+)?)%/gi;
  let m;
  while ((m = p1.exec(text)) !== null) {
    const name = m[1].trim();
    const conf = parseFloat(m[2]);
    const key = name.toLowerCase();
    if (!seen.has(key) && conf > 0) {
      seen.add(key);
      found.push({ name, confidence: conf, category: inferCategory(name) });
    }
  }

  // Pattern 2: ObjectName (XX.X% confidence) — unquoted known class names
  for (const cls of KNOWN_CLASSES) {
    const re = new RegExp(`\\b${cls}\\b[^.]*?([0-9]+(?:\\.[0-9]+)?)%`, "gi");
    while ((m = re.exec(text)) !== null) {
      const key = cls.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ name: cls, confidence: parseFloat(m[1]), category: inferCategory(cls) });
      }
    }
  }

  return found;
}

function inferCategory(name) {
  const n = name.toLowerCase();
  if (["handgun", "knife", "shotgun", "hammer", "weapon"].some(w => n.includes(w))) return "Weapons";
  if (n.includes("blood")) return "Biological Evidence";
  if (n.includes("finger") || n.includes("print")) return "Trace Evidence";
  if (n.includes("glass")) return "Physical Evidence";
  if (n.includes("person") || n.includes("body") || n.includes("victim")) return "Human Presence";
  return "";
}

function parseDetectionBlocks(text) {
  if (!text) return [];

  const clean = text.replace(/\*\*/g, "").replace(/\*/g, "");
  const blocks = [];
  let cur = null;
  let interpLines = [];

  const flush = () => {
    if (cur) {
      if (cur._p) { cur.detections.push(cur._p); cur._p = null; }
      cur.interpretation = interpLines.join(" ").trim();
      if (cur.detections.length === 0 && cur.interpretation) {
        cur.detections = extractDetectionsFromText(cur.interpretation);
      }

      // ✅ Check if a block with same filename already exists — merge into it
      const existing = blocks.find(b => b.file === cur.file);
      if (existing) {
        existing.detections.push(...cur.detections);
        if (cur.interpretation) {
          existing.interpretation = existing.interpretation
            ? existing.interpretation + " " + cur.interpretation
            : cur.interpretation;
        }
      } else {
        blocks.push(cur);
      }
    }
    interpLines = [];
  };

  for (const line of clean.split("\n")) {
    const t = line.trim();
    if (!t) continue;

    const evMatch     = t.match(/^Evidence\s+File[:\s]+(.+)/i);
    const modelMatch  = t.match(/^Model\s+Used[:\s]+(.+)/i);
    const objMatch    = t.match(/^Object[:\s]+(.+)/i);
    const confMatch   = t.match(/^Confidence[:\s]+([0-9.]+)%?/i);
    const catMatch    = t.match(/^Category[:\s]+(.+)/i);
    const interpMatch = t.match(/^Forensic\s+Interpretation[:\s]+(.+)/i);

    if (evMatch) {
      flush();
      const filename = evMatch[1].trim();
      // ✅ Reuse existing block if same filename, don't create duplicate
      const existing = blocks.find(b => b.file === filename);
      if (existing) {
        cur = existing;
        // Remove from blocks temporarily so flush can re-merge
        blocks.splice(blocks.indexOf(existing), 1);
      } else {
        cur = { file: filename, model: "", detections: [], interpretation: "", _p: null };
      }
      interpLines = [];
    } else if (modelMatch && cur) {
      cur.model = modelMatch[1].trim();
    } else if (objMatch && cur) {
      if (cur._p) cur.detections.push(cur._p);
      cur._p = { name: objMatch[1].trim(), confidence: 0, category: "" };
    } else if (confMatch && cur && cur._p) {
      cur._p.confidence = parseFloat(confMatch[1]);
    } else if (catMatch && cur && cur._p) {
      cur._p.category = catMatch[1].trim();
      cur.detections.push(cur._p);
      cur._p = null;
    } else if (interpMatch && cur) {
      interpLines = [interpMatch[1].trim()];
    } else if (interpLines.length > 0 && cur && t.length > 10) {
      interpLines.push(t);
    }
  }
  flush();

  return blocks;
}
function parseWitnesses(text) {
  if (!text) return [];
  
  const clean = text.replace(/\*\*/g, "").replace(/\*/g, "");
  
  if (
    clean.trim().length < 80 &&
    /no witness/i.test(clean)
  ) return [];

  const witnesses = [];
  const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);

  let cur = null;
  let summaryLines = [];

  const flush = () => {
    if (cur && cur.name) {
      witnesses.push({ ...cur, statement: summaryLines.join(" ").trim() });
    }
    cur = null;
    summaryLines = [];
  };

  for (const line of lines) {
    const nameMatch    = line.match(/^Witness\s+Name[:\s]+(.+)/i);
    const contactMatch = line.match(/^Contact[:\s]+(.+)/i);
    const dateMatch    = line.match(/^Date\s+of\s+Statement[:\s]+(.+)/i);
    const summaryMatch = line.match(/^Summary[:\s]+(.+)/i);

    if (nameMatch) {
      flush();
      cur = { name: nameMatch[1].trim(), contact: "", date: "" };
      summaryLines = [];
    } else if (contactMatch && cur) {
      cur.contact = contactMatch[1].trim();
    } else if (dateMatch && cur) {
      // Strip ugly time part: "2026-04-09 00:00:00" → "2026-04-09"
      cur.date = dateMatch[1].trim().replace(/\s+\d{2}:\d{2}:\d{2}$/, "");
    } else if (summaryMatch && cur) {
      summaryLines = [summaryMatch[1].trim()];
    } else if (cur && summaryLines.length > 0 && line.length > 10) {
      // Continuation of summary on next lines
      summaryLines.push(line);
    }
  }
  flush();

  return witnesses;
}
function parseConclusions(text) {
  if (!text) return { summary: "", steps: [], disclaimer: "" };
  const steps = [];
  let summary = "";
  let disclaimer = "";
  let inSteps = false;

  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const stepMatch = t.match(/^\d+\.\s+\*{0,2}(.+?)\*{0,2}:?\s*(.*)/);
    if (stepMatch) {
      inSteps = true;
      const title = stepMatch[1].replace(/\*\*/g, "").trim();
      const detail = stepMatch[2].replace(/\*\*/g, "").trim();
      steps.push(detail ? `${title}: ${detail}` : title);
    } else if (t.toLowerCase().startsWith("disclaimer") || t.toLowerCase().includes("ai finding")) {
      disclaimer = t.replace(/^disclaimer[:\s]*/i, "").trim();
    } else if (!inSteps && t.length > 40 && !/^suggested/i.test(t)) {
      summary += (summary ? " " : "") + t;
    }
  }
  return { summary, steps, disclaimer };
}

function parseEvidenceList(text) {
  if (!text) return { files: [], descriptions: [] };
  const lines = text.split("\n").filter(l => l.trim());
  const files = [];
  const descriptions = [];
  for (const line of lines) {
    const t = line.trim();
    if (/\.(jpg|jpeg|png|gif|bmp|webp|pdf|mp4|avi|mov|docx|doc)/i.test(t)) {
      files.push(t.replace(/^\d+\.\s*/, "").trim());
    } else if (t.length > 15 && !/^(total|files|description)/i.test(t)) {
      descriptions.push(t);
    }
  }
  return { files, descriptions };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const ACCENT_COLORS = {
  blue:   { border: "#3b82f6", glow: "rgba(59,130,246,0.12)", badge: "#1e3a8a", badgeText: "#93c5fd" },
  indigo: { border: "#6366f1", glow: "rgba(99,102,241,0.12)", badge: "#1e1b4b", badgeText: "#a5b4fc" },
  purple: { border: "#8b5cf6", glow: "rgba(139,92,246,0.12)", badge: "#2e1065", badgeText: "#c4b5fd" },
  green:  { border: "#10b981", glow: "rgba(16,185,129,0.12)", badge: "#064e3b", badgeText: "#6ee7b7" },
  amber:  { border: "#f59e0b", glow: "rgba(245,158,11,0.12)", badge: "#451a03", badgeText: "#fcd34d" },
  teal:   { border: "#14b8a6", glow: "rgba(20,184,166,0.12)", badge: "#042f2e", badgeText: "#5eead4" },
  pink:   { border: "#ec4899", glow: "rgba(236,72,153,0.12)", badge: "#500724", badgeText: "#f9a8d4" },
  gray:   { border: "#6b7280", glow: "rgba(107,114,128,0.10)", badge: "#1f2937", badgeText: "#d1d5db" },
  red:    { border: "#ef4444", glow: "rgba(239,68,68,0.12)", badge: "#450a0a", badgeText: "#fca5a5" },
};

function SectionCard({ icon, title, badge, children, accent = "blue", num }) {
  const c = ACCENT_COLORS[accent];
  return (
    <div
      className="frr-section"
      style={{ borderLeft: `3px solid ${c.border}`, background: `linear-gradient(135deg, ${c.glow} 0%, transparent 60%)` }}
    >
      <div className="frr-section-header">
        <div className="frr-section-title-row">
          {num && <span className="frr-section-num" style={{ background: c.border }}>{num}</span>}
          <span className="frr-section-icon">{icon}</span>
          <h3 className="frr-section-title" style={{ color: c.border }}>{title}</h3>
        </div>
        {badge && (
          <span className="frr-badge" style={{ background: c.badge, color: c.badgeText }}>
            {badge}
          </span>
        )}
      </div>
      <div className="frr-section-body">{children}</div>
    </div>
  );
}

function ConfidenceBar({ label, value }) {
  const color = value >= 80 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
  const level = value >= 80 ? "HIGH" : value >= 60 ? "MODERATE" : "LOW";
  return (
    <div className="frr-conf-row">
      <div className="frr-conf-meta">
        <span className="frr-conf-label">{label}</span>
        <div className="frr-conf-right">
          <span className="frr-conf-level" style={{ color, background: `${color}20` }}>{level}</span>
          <span className="frr-conf-pct" style={{ color }}>{value.toFixed(1)}%</span>
        </div>
      </div>
      <div className="frr-conf-track">
        <div className="frr-conf-fill" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
        <div className="frr-conf-marker" style={{ left: `${value}%` }} />
      </div>
    </div>
  );
}

function KpiGrid({ rows }) {
  const keyFields = ["Case ID", "Case Title", "Priority", "Status", "Category", "Report Generated"];
  const kpis = rows.filter(r => keyFields.some(k => r.label.includes(k)));

  const kpiStyle = (label, value) => {
    if (label.includes("Priority")) {
      const map = { High: "#ef4444", Critical: "#dc2626", Medium: "#f59e0b", Low: "#10b981" };
      return { color: map[value] || "#f1f1f1" };
    }
    if (label.includes("Status")) {
      const map = { New: "#93c5fd", Active: "#fdba74", Completed: "#86efac", Closed: "#86efac", Pending: "#fdba74" };
      return { color: map[value] || "#f1f1f1" };
    }
    return {};
  };

  return (
    <div className="frr-kpi-grid">
      {kpis.map(({ label, value }) => (
        <div key={label} className="frr-kpi-card">
          <div className="frr-kpi-label">{label}</div>
          <div className="frr-kpi-value" style={kpiStyle(label, value)}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function CaseTable({ rows }) {
  const keyFields = ["Case ID", "Case Title", "Priority", "Status", "Category", "Report Generated"];
  const rest = rows.filter(r => !keyFields.some(k => r.label.includes(k)));
  return (
    <div className="frr-table-wrap">
      <table className="frr-table">
        <tbody>
          {rest.map(({ label, value }) => (
            <tr key={label} className="frr-table-row">
              <td className="frr-table-label">{label}</td>
              <td className="frr-table-value">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileIcon({ filename }) {
  const ext = (filename.match(/\.(\w+)$/) || [])[1]?.toLowerCase();
  const map = { jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", pdf: "📄", mp4: "🎥", avi: "🎥", mov: "🎥", docx: "📝", doc: "📝" };
  return <span>{map[ext] || "📁"}</span>;
}

function DetectionBlock({ block }) {
  const totalDetections = block.detections.length;

  return (
    <div className="frr-det-block">
      <div className="frr-det-block-top">
        <div className="frr-det-file-row">
          <span className="frr-det-file-icon">📁</span>
          <span className="frr-det-filename">{block.file}</span>
        </div>
        <div className="frr-det-tags">
          {block.model && (
            <span className="frr-det-model">{block.model.replace(/_/g, " ").toUpperCase()}</span>
          )}
          <span className={`frr-det-count ${totalDetections > 0 ? "has-detections" : "no-detections"}`}>
            {totalDetections > 0 ? `${totalDetections} Object${totalDetections > 1 ? "s" : ""} Detected` : "No Objects Detected"}
          </span>
        </div>
      </div>

      {block.detections.length > 0 ? (
        <div className="frr-det-content">
          <div className="frr-det-chips-row">
            {block.detections.map((d, i) => (
              <div key={i} className="frr-det-chip">
                <span className="frr-det-chip-icon">🎯</span>
                <div className="frr-det-chip-info">
                  <span className="frr-det-chip-name">{d.name}</span>
                  {d.category && <span className="frr-det-chip-cat">{d.category}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="frr-conf-section-label">Confidence Analysis</div>
          <div className="frr-conf-bars">
            {block.detections.map((d, i) => (
              <ConfidenceBar key={i} label={d.name} value={d.confidence} />
            ))}
          </div>
        </div>
      ) : (
        <div className="frr-det-empty">⚠️ No objects were detected in this evidence file</div>
      )}

      {block.interpretation && (
        <div className="frr-det-interp">
          <div className="frr-det-interp-label">🔬 Forensic Interpretation</div>
          <p className="frr-det-interp-text">{block.interpretation}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForensicReportRenderer({ reportText }) {
  const sections = useMemo(() => parseReport(reportText), [reportText]);
  if (!sections) return null;

  const caseRows   = useMemo(() => parseCaseDetails(sections.caseDetails), [sections.caseDetails]);
  const detBlocks  = useMemo(() => {
    const blocks = parseDetectionBlocks(sections.detection);
    if (blocks.length === 0 && sections.detection) {
      const mined = extractDetectionsFromText(sections.detection);
      if (mined.length > 0) {
        return [{ file: "Evidence Analysis", model: "crime_scene", detections: mined, interpretation: sections.detection }];
      }
    }
    return blocks;
  }, [sections.detection]);
  const witnesses  = useMemo(() => parseWitnesses(sections.witness), [sections.witness]);
  const conclusions = useMemo(() => parseConclusions(sections.conclusions), [sections.conclusions]);
  const evidenceParsed = useMemo(() => parseEvidenceList(sections.evidence || ""), [sections.evidence]);

  const totalObjects = detBlocks.reduce((a, b) => a + b.detections.length, 0);

  return (
    <div className="frr-root">

      {/* ── 1. Executive Summary ── */}
      {sections.executive && (
        <SectionCard icon="📋" title="Executive Summary" accent="blue" num="1">
          <p className="frr-prose">{sections.executive}</p>
        </SectionCard>
      )}

      {/* ── 2. Case Details ── */}
      {caseRows.length > 0 && (
        <SectionCard icon="🗂️" title="Case Details" accent="indigo" num="2">
          <KpiGrid rows={caseRows} />
          <CaseTable rows={caseRows} />
        </SectionCard>
      )}

      {/* ── 3. Evidence Inventory ── */}
      {sections.evidence && (
        <SectionCard
          icon="🗃️"
          title="Evidence Inventory"
          badge={evidenceParsed.files.length > 0 ? `${evidenceParsed.files.length} file${evidenceParsed.files.length > 1 ? "s" : ""}` : null}
          accent="purple"
          num="3"
        >
          {evidenceParsed.files.length > 0 ? (
            <div className="frr-ev-list">
              {evidenceParsed.files.map((f, i) => {
                const ext = (f.match(/\.(\w+)$/) || [])[1]?.toUpperCase() || "FILE";
                return (
                  <div key={i} className="frr-ev-item">
                    <span className="frr-ev-num">{i + 1}</span>
                    <FileIcon filename={f} />
                    <span className="frr-ev-name">{f}</span>
                    <span className="frr-ev-ext">{ext}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="frr-prose">{sections.evidence}</p>
          )}
          {evidenceParsed.descriptions.map((d, i) => (
            <p key={i} className="frr-prose frr-prose-sm">{d}</p>
          ))}
        </SectionCard>
      )}

      {/* ── 4. AI Detection Analysis ── */}
      {detBlocks.length > 0 && (
        <SectionCard
          icon="🔍"
          title="AI Detection Analysis"
          badge={totalObjects > 0 ? `${totalObjects} object${totalObjects > 1 ? "s" : ""} found` : "No objects"}
          accent="green"
          num="4"
        >
          <div className="frr-det-blocks">
            {detBlocks.map((block, i) => (
              <DetectionBlock key={i} block={block} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── 5. Scene Interpretation ── */}
      {sections.scene && (
        <SectionCard icon="🏚️" title="Scene Interpretation" accent="amber" num="5">
          <p className="frr-prose">{sections.scene}</p>
        </SectionCard>
      )}

      {/* ── 6. Witness Testimony ── */}
      <SectionCard
        icon="👥"
        title="Witness Testimony Summary"
        badge={witnesses.length > 0 ? `${witnesses.length} witness${witnesses.length > 1 ? "es" : ""}` : null}
        accent="teal"
        num="6"
      >
        {witnesses.length === 0 ? (
          <div className="frr-empty-state">
            <span className="frr-empty-icon">📭</span>
            <p>No witness statements were recorded for this case.</p>
          </div>
        ) : (
          <div className="frr-witnesses">
            {witnesses.map((w, i) => (
              <div key={i} className="frr-witness-card">
                <div className="frr-witness-top">
                  <span className="frr-witness-name">👤 {w.name}</span>
                  {w.date && w.date !== "Not specified" && (
                    <span className="frr-witness-date">📅 {w.date}</span>
                  )}
                </div>
                {w.contact && w.contact !== "Not specified" && (
                  <div className="frr-witness-contact">📞 {w.contact}</div>
                )}
                {w.statement && <p className="frr-witness-stmt">"{w.statement}"</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── 7. 3D Reconstruction ── */}
      {sections.reconstruction && (
        <SectionCard icon="📐" title="3D Reconstruction Status" accent="pink" num="7">
          <div className="frr-recon-box">
            <span className="frr-recon-badge">PENDING</span>
            <p className="frr-prose">{sections.reconstruction}</p>
          </div>
        </SectionCard>
      )}

      {/* ── 8. Investigator Notes ── */}
      <SectionCard icon="📝" title="Investigator Notes" accent="gray" num="8">
        <div className="frr-notes-box">
          <p className="frr-notes-hint">
            ✏️ Reserved for manual notes and observations by the lead forensic investigator.
          </p>
          <div className="frr-notes-lines">
            {[...Array(5)].map((_, i) => <div key={i} className="frr-notes-line" />)}
          </div>
        </div>
      </SectionCard>

      {/* ── 9. AI-Assisted Conclusions ── */}
      {(conclusions.summary || conclusions.steps.length > 0) && (
        <SectionCard icon="🤖" title="AI-Assisted Conclusions" accent="red" num="9">
          {conclusions.summary && (
            <p className="frr-prose" style={{ marginBottom: conclusions.steps.length ? 20 : 0 }}>
              {conclusions.summary}
            </p>
          )}
          {conclusions.steps.length > 0 && (
            <>
              <div className="frr-steps-heading">📌 Suggested Next Investigative Steps</div>
              <ol className="frr-steps">
                {conclusions.steps.map((step, i) => (
                  <li key={i} className="frr-step">
                    <span className="frr-step-num">{i + 1}</span>
                    <span className="frr-step-text">{step}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {conclusions.disclaimer && (
            <div className="frr-disclaimer">
              <span className="frr-disclaimer-icon">⚠️</span>
              <p>{conclusions.disclaimer}</p>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
