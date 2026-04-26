# backend/app/services/report_service.py
import os
import json
import requests
from datetime import datetime
from database import get_connection

import time
import random

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


def get_case_data(case_id: int) -> dict:
    """Fetch all case data from the database"""
    conn = get_connection()
    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT c.*, u.name as investigator_name, u.email as investigator_email
            FROM cases c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id = %s
        """, (case_id,))
        case = cur.fetchone()

        if not case:
            return None

        cur.execute("""
            SELECT id, filename, filepath, uploaded_at
            FROM evidence
            WHERE case_id = %s
            ORDER BY uploaded_at ASC
        """, (case_id,))
        evidence = cur.fetchall()

        cur.execute("""
            SELECT dr.*, e.filename as evidence_filename
            FROM object_detection_results dr
            LEFT JOIN evidence e ON dr.evidence_id = e.id
            WHERE dr.case_id = %s
            ORDER BY dr.created_at ASC
        """, (case_id,))
        detection_results = cur.fetchall()

        cur.execute("""
            SELECT id, witness_name, statement, contact_info, statement_date, created_at
            FROM witness_statements
            WHERE case_id = %s
            ORDER BY created_at ASC
        """, (case_id,))
        witness_statements = cur.fetchall()

        return {
            "case": dict(case),
            "evidence": [dict(e) for e in evidence],
            "detection_results": [dict(d) for d in detection_results],
            "witness_statements": [dict(w) for w in witness_statements],
        }
    finally:
        conn.close()


def build_gemini_prompt(data: dict) -> str:
    """Build the prompt to send to Gemini"""
    case = data["case"]
    evidence = data["evidence"]
    detection_results = data["detection_results"]
    witness_statements = data["witness_statements"]

    detection_summary = []
    for result in detection_results:
        try:
            results_json = result.get("results") or {}
            if isinstance(results_json, str):
                results_json = json.loads(results_json)
            detections = results_json.get("detections", [])
            model_type = result.get("model_type", "unknown")
            filename = result.get("evidence_filename", f"Evidence #{result.get('evidence_id')}")
            detection_summary.append({
                "evidence_file": filename,
                "model_used": model_type,
                "total_detections": results_json.get("total_detections", 0),
                "detected_objects": [
                    {
                        "object": d.get("class_name"),
                        "confidence": round(d.get("confidence", 0) * 100, 1),
                        "category": d.get("category")
                    }
                    for d in detections
                ],
                "category_counts": results_json.get("category_counts", {}),
            })
        except Exception:
            continue

    witness_summary = []
    for w in witness_statements:
        witness_summary.append({
            "name": w.get("witness_name"),
            "statement": w.get("statement"),
            "contact": w.get("contact_info"),
            "date": str(w.get("statement_date", "Not specified")),
        })

    prompt = f"""You are a professional forensic analyst. Based on the following case data, generate a formal and detailed forensic investigation report.

=== CASE INFORMATION ===
Case ID: {case.get('id')}
Case Title: {case.get('name')}
Description: {case.get('description') or 'Not provided'}
Category: {case.get('category') or 'Not specified'}
Priority: {case.get('priority') or 'Not specified'}
Status: {case.get('status') or 'New'}
Incident Date: {case.get('incident_date') or 'Not specified'}
Client / Department: {case.get('client') or 'Not specified'}
Investigating Officer: {case.get('investigating_officer') or 'Not assigned'}
Created By: {case.get('investigator_name') or 'Unknown'}
Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

=== EVIDENCE SUMMARY ===
Total Evidence Files: {len(evidence)}
Files: {', '.join([e.get('filename', '') for e in evidence]) or 'None'}

=== AI OBJECT DETECTION FINDINGS ===
{json.dumps(detection_summary, indent=2) if detection_summary else 'No object detection analysis performed yet.'}

=== WITNESS STATEMENTS ===
{json.dumps(witness_summary, indent=2) if witness_summary else 'No witness statements recorded.'}

=== INSTRUCTIONS ===
Generate a structured forensic report with EXACTLY the sections below.

CRITICAL FORMATTING RULES - YOU MUST FOLLOW THESE:
- Do NOT use markdown. No **, no *, no #, no backticks, no bullet points with -.
- Use plain text only.
- Section headers must be in ALL CAPS followed by dashes on the next line.
- For witness statements use EXACTLY this format for each witness:
  Witness Name: [name]
  Contact: [contact]
  Date of Statement: [date]
  Summary: [summary text on one line]
- For detection results use EXACTLY this format for each evidence file:
  Evidence File: [filename]
  Model Used: [model]
  Object: [object name]
  Confidence: [XX.X]%
  Category: [category]
  Forensic Interpretation: [interpretation text]
- If there are no witness statements write: No witness statements were recorded for this case.
- If no detection was performed write: No object detection analysis has been performed.

SECTIONS TO GENERATE:

1. EXECUTIVE SUMMARY
Brief overview of the case and key findings.

2. CASE DETAILS
All case metadata presented professionally using Label: Value format.

3. EVIDENCE INVENTORY
List all uploaded evidence files.

4. AI DETECTION ANALYSIS
For each detection result follow the exact Evidence File / Object / Confidence / Category / Forensic Interpretation format above.

5. SCENE INTERPRETATION
Based on detected objects, provide a professional forensic interpretation of the scene.

6. WITNESS TESTIMONY SUMMARY
For each witness follow the exact Witness Name / Contact / Date of Statement / Summary format above.

7. 3D RECONSTRUCTION STATUS
State that 3D reconstruction analysis is pending if not available.

8. INVESTIGATOR NOTES
Leave a placeholder section for manual investigator notes.

9. AI-ASSISTED CONCLUSIONS
Summarize findings and suggest numbered next investigative steps.
End with: Disclaimer: AI findings must be verified by a trained forensic investigator.

Write in formal forensic report language. Be thorough and professional."""

    return prompt

def call_gemini_api(prompt: str, retries=5):
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")

    headers = {"Content-Type": "application/json"}

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 8192,
        }
    }

    for attempt in range(retries):
        response = requests.post(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            headers=headers,
            json=payload,
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()
            return result["candidates"][0]["content"]["parts"][0]["text"]

        # retry only for server overload
        if response.status_code in [429, 503, 500]:
            wait = (2 ** attempt) + random.uniform(0, 1)
            print(f"Retrying Gemini... attempt {attempt+1}, waiting {wait:.2f}s")
            time.sleep(wait)
            continue

        raise Exception(f"Gemini API error {response.status_code}: {response.text}")

    raise Exception("Gemini failed after multiple retries")


def save_report_to_db(case_id: int, user_id: int, report_text: str,
                      evidence_count: int, detection_count: int, witness_count: int) -> int:
    """Save generated report to the case_reports table, returns new report id"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO case_reports (case_id, user_id, report_text, evidence_count, detection_count, witness_count)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (case_id, user_id, report_text, evidence_count, detection_count, witness_count))
        report_id = cur.fetchone()["id"]
        conn.commit()
        return report_id
    finally:
        conn.close()


def get_reports_for_case(case_id: int) -> list:
    """Fetch all saved reports for a case"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT cr.id, cr.case_id, cr.report_text, cr.evidence_count,
                   cr.detection_count, cr.witness_count, cr.created_at,
                   u.name as generated_by
            FROM case_reports cr
            LEFT JOIN users u ON cr.user_id = u.id
            WHERE cr.case_id = %s
            ORDER BY cr.created_at DESC
        """, (case_id,))
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def delete_report_from_db(report_id: int) -> bool:
    """Delete a saved report by id"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM case_reports WHERE id = %s", (report_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def generate_case_report(case_id: int, user_id: int) -> dict:
    """
    Generate a forensic report, save to DB, and return the result.
    """
    data = get_case_data(case_id)
    if not data:
        raise ValueError(f"Case {case_id} not found")

    evidence_count = len(data["evidence"])
    detection_count = len(data["detection_results"])
    witness_count = len(data["witness_statements"])

    prompt = build_gemini_prompt(data)
    report_text = call_gemini_api(prompt)

    report_id = save_report_to_db(
        case_id=case_id,
        user_id=user_id,
        report_text=report_text,
        evidence_count=evidence_count,
        detection_count=detection_count,
        witness_count=witness_count,
    )

    case = data["case"]
    return {
        "id": report_id,
        "case_id": case_id,
        "case_name": case.get("name"),
        "generated_at": datetime.now().isoformat(),
        "report": report_text,
        "evidence_count": evidence_count,
        "detection_count": detection_count,
        "witness_count": witness_count,
    }