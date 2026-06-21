# ForenVision

**AI-Powered 3D Crime Scene Reconstruction & Forensic Investigation Platform**

ForenVision helps forensic investigators document, analyze, and reconstruct crime scenes using AI. It combines object detection, single-image 3D reconstruction, and LLM-generated investigation reports into one workflow — from uploading evidence to producing a court-ready report.

---

## Overview

Crime scene investigation in many forensic agencies, especially across Pakistan, still relies on manual documentation: photographs, sketches, and human judgment calls about spatial relationships between evidence. This is slow, error-prone, and depends heavily on specialized hardware (laser scanners, etc.) that's impractical for most local labs.

ForenVision addresses this with an integrated AI pipeline:

1. **Detect** — a YOLOv8 model identifies and classifies forensic objects (weapons, blood, fingerprints, shoeprints, human/body components) in uploaded 2D evidence images.
2. **Reconstruct** — TripoSR converts a single 2D evidence image into an interactive 3D model, so investigators can view evidence from multiple angles.
3. **Report** — an LLM (via the Gemini API) compiles case details, detected evidence, witness statements, and scene interpretation into a structured forensic report.

The goal is to reduce investigation time, cut down on human error, and make documentation more consistent — strengthening the reliability of evidence presented in court.

---

## Features

- **Case management** — create, update, search, filter, and track cases by status and priority
- **Evidence upload & object detection** — YOLOv8 detects forensic objects in uploaded images with confidence scores and bounding boxes
- **2D → 3D reconstruction** — turn a single evidence image into an interactive 3D model via TripoSR
- **AI-generated investigation reports** — Gemini-powered summaries covering case details, evidence, witness statements, and scene interpretation
- **Role-based access control** — Admin, Investigator, and Public User roles with JWT authentication
- **Contact request workflow** — public submissions are reviewed by admins and assigned to investigators
- **Investigator management** — track specialization, department, experience, availability, and workload

---


## Tech Stack

**Frontend**
React.js, Vite, React Router DOM, Tailwind CSS, Lucide React (icons)

**Backend**
FastAPI (Python), Uvicorn, Pydantic, PyJWT, Bcrypt/Passlib

**AI / Machine Learning**
YOLOv8 (Ultralytics) for object detection, PyTorch (CUDA), OpenCV, TripoSR for single-image 3D reconstruction, Gemini API for report generation

**Database**
PostgreSQL, SQLAlchemy / psycopg2

**Auth & Security**
JWT bearer tokens, role-based access control (RBAC), password hashing

**API**
RESTful endpoints, CORS middleware, JSON/JSONB

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- PostgreSQL
- A Gemini API key (for report generation)
- GPU recommended for faster object detection inference (not required)

### 1. Clone the repo

```bash
git clone https://github.com/AmnaBukhari123/forenvision.git
cd forenvision
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/` (never commit this file — see below):

```
DATABASE_URL=postgresql://user:password@localhost:5432/forenvision
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
```

Run the backend:

```bash
uvicorn main:app --reload
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
npm run dev
```

> Adjust the commands above if your actual `package.json` / backend entry point use different script names — these reflect the standard Vite + FastAPI conventions used in this project.

---

## Project Structure

```
forenvision/
├── backend/        # FastAPI app, API routes, AI/ML pipeline, DB models
├── frontend/        # React + Vite app
└── README.md
```

---

## Team

This project was developed as a Final Year Project (BS Software Engineering) at COMSATS University Islamabad, Lahore Campus, Session 2022–2026.

- **Amna Bukhari** — FA22-BSE-141
- **Maham Naveed** — FA22-BSE-013

**Supervisor:** Dr. Tariq Umer

---

## Roadmap / Future Work

- Real-time evidence detection
- Advanced 3D crime scene reconstruction (multi-image scenes)
- Integration of additional AI models (e.g. blood spatter, fingerprint matching)
- OSINT (Open Source Intelligence) integration
- Mobile application support
- Geospatial and mapping capabilities

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.