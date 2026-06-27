# Kairix AI

**AI-powered career coaching** — upload your CV, speak your target role, and receive instant, personalized career feedback powered by LLM + RAG.

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat&logo=fastapi&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-llama--3.3--70b-F55036?style=flat)
![ChromaDB](https://img.shields.io/badge/ChromaDB-RAG-00A36C?style=flat)
![Netlify](https://img.shields.io/badge/Frontend-Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)
![Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?style=flat&logo=railway&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

---

## Overview

Kairix AI (from *Kairos* — the Greek concept of the perfect moment) helps job seekers understand exactly where they stand and what to do next. Users upload a CV (JPG, PNG, PDF, or DOCX), speak or type their target role, and receive a scored breakdown of strengths, skill gaps, recommended improvements, and actionable next steps — all in under 10 seconds.

**Live demo:** [kairix.netlify.app](https://kairix.netlify.app) &nbsp;|&nbsp; **API:** Deployed on Railway

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  BROWSER (Frontend)                   │
│          index.html · app.js · style.css              │
│                                                       │
│  1. Upload CV (JPG / PNG / PDF / DOCX)               │
│  2. Speak job goal → Web Speech API                  │
│  3. Click "Analyze My Career"                        │
│  4. Hear feedback → Web Speech Synthesis             │
└────────────────────────┬─────────────────────────────┘
                         │  POST /analyze
                         ▼
┌──────────────────────────────────────────────────────┐
│              FastAPI BACKEND (Railway)                │
│                                                       │
│  ┌─────────────────┐   ┌────────────────────────┐   │
│  │   vision.py      │   │        rag.py           │   │
│  │  Google Vision   │   │  LangChain + ChromaDB   │   │
│  │  pdfplumber      │   │  all-MiniLM-L6-v2       │   │
│  │  python-docx     │   │  (job market context)   │   │
│  └────────┬─────────┘   └──────────┬─────────────┘   │
│           │                        │                  │
│           └────────────┬───────────┘                  │
│                        ▼                              │
│              ┌──────────────────┐                    │
│              │   ai_coach.py    │                    │
│              │  Groq API        │                    │
│              │  llama-3.3-70b   │                    │
│              │  (Feedback JSON) │                    │
│              └────────┬─────────┘                    │
│                       │                              │
│              ┌────────▼─────────┐                   │
│              │  automation.py   │                   │
│              │  n8n Webhook     │                   │
│              └────────┬─────────┘                   │
└───────────────────────┼──────────────────────────────┘
                        │
          ┌─────────────┴──────────────┐
          ▼                            ▼
 ┌─────────────────┐        ┌──────────────────┐
 │  Gmail (SMTP)   │        │  Google Sheets   │
 │  (report email) │        │  (session log)   │
 └─────────────────┘        └──────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Voice Input | Web Speech API (SpeechRecognition) |
| Text-to-Speech | Web Speech Synthesis API |
| Backend | FastAPI (Python 3.10+) |
| CV OCR | Google Cloud Vision API (images) |
| PDF Extraction | pdfplumber |
| DOCX Extraction | python-docx |
| Embeddings | Sentence Transformers — all-MiniLM-L6-v2 |
| Vector Store | ChromaDB |
| RAG Framework | LangChain |
| AI Model | Groq — llama-3.3-70b-versatile |
| Automation | n8n → Gmail SMTP + Google Sheets |
| Frontend Hosting | Netlify |
| Backend Hosting | Railway (nixpacks) |

---

## Prerequisites

- Python 3.10+
- Google Cloud Vision API key (free tier: 1,000 requests/month)
- Groq API key (free tier available at [console.groq.com](https://console.groq.com))
- n8n (optional — for email + Google Sheets automation)

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/mtahir-ds/kairix-ai.git
cd kairix-ai
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

```env
GOOGLE_CLOUD_VISION_API_KEY=your_google_vision_key
GROQ_API_KEY=your_groq_api_key
N8N_WEBHOOK_URL=your_n8n_webhook_url     # leave blank to skip automation
CHROMA_PERSIST_DIR=./chroma_db
```

### 5. Load the knowledge base

Run this once to embed job market data into ChromaDB:

```bash
python knowledge_base/load_data.py
```

Expected output:
```
Loading knowledge base...
Split into 42 chunks. Embedding now...
Done! 42 chunks stored in ChromaDB at: .../chroma_db
```

### 6. Start the backend server

```bash
uvicorn main:app --reload --port 8000
```

Verify it's running:

```bash
curl http://localhost:8000/
# {"status":"Kairix AI is running","version":"1.0.0"}

curl http://localhost:8000/health
# {"chroma_ready":true,"document_count":42}
```

### 7. Open the frontend

**Option A** — Open directly:
```
frontend/index.html
```
Double-click the file in Explorer or Finder.

**Option B** — Serve with Python (avoids browser file restrictions):
```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

> **Browser compatibility:** Web Speech API requires **Google Chrome** or **Microsoft Edge**. Firefox has limited support.

---

## How to Get API Keys

### Google Cloud Vision API

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Search for **Cloud Vision API** → click **Enable**
4. Go to **APIs & Services** → **Credentials** → **+ Create Credentials** → **API Key**
5. (Recommended) Restrict the key to Cloud Vision API only
6. Copy and paste into `.env` as `GOOGLE_CLOUD_VISION_API_KEY`

Free tier: **1,000 units/month** — sufficient for development and portfolio demos.

### Groq API

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to **API Keys** → **Create API Key**
4. Copy and paste into `.env` as `GROQ_API_KEY`

Free tier: generous rate limits — no credit card required.

---

## n8n Automation (Optional)

Automates emailing the coaching report to the user and logging each session to Google Sheets.

### Install n8n

```bash
npm install -g n8n
n8n start
# Open http://localhost:5678
```

### Build the Workflow

1. **Create a new workflow**
2. **Add a Webhook node:**
   - Method: `POST`
   - Path: `kairix`
   - Click **Listen for Test Event** → copy the URL → paste into `.env` as `N8N_WEBHOOK_URL`
3. **Add a Gmail node:**
   - To: `{{ $json.body.email }}`
   - Subject: `Your Kairix AI Report — Score: {{ $json.body.overall_score }}/10`
   - Body: use `$json.body.strengths`, `$json.body.skill_gaps`, `$json.body.next_steps`, etc.
4. **Add a Google Sheets node:**
   - Operation: Append Row
   - Columns: `timestamp`, `email`, `job_goal`, `overall_score`
5. **Activate the workflow** with the toggle in the top-right corner

---

## How to Use Kairix AI

1. **Upload your CV** — drag and drop a JPG, PNG, PDF, or DOCX file (max 10 MB)
2. **Record your goal** — click the microphone and say your target role, e.g.:
   > *"I want to become a data analyst at a fintech company in London"*
3. **Add your email** (optional) to receive the full report by email
4. **Click "Analyze My Career"** — Kairix will:
   - Extract text from your CV using Google Vision / pdfplumber / python-docx
   - Retrieve relevant job market context from ChromaDB via RAG
   - Send everything to Groq llama-3.3-70b for scored, structured feedback
5. **Review your results** — score ring, strengths, skill gaps, CV improvements, next steps
6. **Click "Hear Your Feedback"** to listen to the full report via text-to-speech
7. **Download PDF** — export the full coaching report as a styled PDF

---

## Project Structure

```
kairix-ai/
├── backend/
│   ├── main.py                  # FastAPI app — routing and request handling
│   ├── vision.py                # OCR: Google Vision, pdfplumber, python-docx
│   ├── rag.py                   # LangChain + ChromaDB retrieval
│   ├── ai_coach.py              # Groq LLM feedback generation
│   ├── automation.py            # n8n webhook trigger
│   ├── requirements.txt
│   ├── .env.example
│   └── knowledge_base/
│       ├── load_data.py         # One-time ChromaDB setup script
│       └── jobs_data.txt        # Job market knowledge base
├── frontend/
│   ├── index.html               # App shell and markup
│   ├── app.js                   # All UI logic, API calls, PDF export
│   └── style.css                # Design system and animations
├── railway.toml                 # Railway deployment config
├── start.sh                     # Railway startup script
└── README.md
```

---

## API Reference

| Method | Endpoint   | Description                                 |
|--------|------------|---------------------------------------------|
| GET    | `/`        | Health check                                |
| GET    | `/health`  | ChromaDB status and document count          |
| POST   | `/analyze` | Analyze CV — accepts image, PDF, or DOCX   |

### POST `/analyze` — Request

```
Content-Type: multipart/form-data

cv_image   : File   (required) — CV file: JPG, PNG, WEBP, PDF, or DOCX
job_goal   : string (required) — Target role description
user_email : string (optional) — Email address for report delivery
```

### POST `/analyze` — Response

```json
{
  "cv_text": "Extracted CV text...",
  "job_goal": "I want to be a data analyst...",
  "overall_score": 7,
  "score_explanation": "Your CV demonstrates solid technical foundations...",
  "strengths": ["Strong SQL skills", "Relevant project experience"],
  "skill_gaps": ["No Tableau experience", "Missing certifications"],
  "cv_improvements": ["Add a professional summary", "Quantify achievements"],
  "next_steps": ["Complete Google Data Analytics cert", "Build a portfolio project"],
  "motivational_message": "You're closer than you think — one focused month can close these gaps."
}
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `GOOGLE_CLOUD_VISION_API_KEY not set` | Ensure `.env` exists in `backend/` and contains the correct key |
| `Could not extract text from image` | Upload a higher-resolution photo; avoid glare or shadows |
| `Could not extract text from PDF` | PDF must contain selectable text, not a scanned image — use JPG/PNG for scanned CVs |
| `ChromaDB not ready` | Run `python knowledge_base/load_data.py` before starting the server |
| `Cannot connect to backend` | Confirm `uvicorn main:app --reload --port 8000` is running |
| Voice recording not working | Use Google Chrome or Edge; grant microphone permission when prompted |
| n8n webhook not triggering | Verify `N8N_WEBHOOK_URL` is correct and the n8n workflow is activated |

---

## License

MIT — free to use, fork, and build on.
