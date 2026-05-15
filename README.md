# CareerLens AI 🎓

**An AI-powered career coaching system** — upload your CV, speak your dream job, and receive instant AI-driven career feedback.

---

## Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │              USER / BROWSER                  │
                        │  (index.html + app.js + style.css)           │
                        │                                               │
                        │  1. Upload CV image                          │
                        │  2. Speak job goal → Web Speech API          │
                        │  3. Click "Analyze My Career"                │
                        │  4. Hear feedback → Web Speech Synthesis     │
                        └────────────────────┬────────────────────────┘
                                             │ POST /analyze
                                             ▼
                        ┌─────────────────────────────────────────────┐
                        │         FastAPI BACKEND (port 8000)          │
                        │                                               │
                        │  ┌──────────────┐  ┌──────────────────────┐ │
                        │  │  vision.py   │  │       rag.py          │ │
                        │  │ Google Vision│  │ LangChain + ChromaDB  │ │
                        │  │  (OCR CV)    │  │ (job market context)  │ │
                        │  └──────┬───────┘  └──────────┬───────────┘ │
                        │         │                       │             │
                        │         └───────────┬───────────┘             │
                        │                     ▼                         │
                        │           ┌──────────────────┐               │
                        │           │   ai_coach.py     │               │
                        │           │  Claude API        │               │
                        │           │  (Feedback JSON)   │               │
                        │           └────────┬─────────┘               │
                        │                    │                          │
                        │           ┌────────▼─────────┐               │
                        │           │  automation.py    │               │
                        │           │  n8n Webhook      │               │
                        │           └────────┬─────────┘               │
                        └────────────────────┼────────────────────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                                       ▼
                 ┌─────────────────┐                  ┌──────────────────┐
                 │   Gmail / Email  │                  │  Google Sheets   │
                 │  (report sent)   │                  │  (session log)   │
                 └─────────────────┘                  └──────────────────┘
```

---

## Prerequisites

- **Python 3.10+**
- **Google Cloud Vision API key** (free tier: 1,000 requests/month)
- **Anthropic API key** (Claude claude-sonnet-4-20250514)
- **n8n** (optional — for email + Google Sheets automation)

---

## Setup Instructions

### 1. Clone or download the project

```bash
git clone <your-repo-url>
cd career-lens-ai
```

### 2. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

> **Tip:** Use a virtual environment:
> ```bash
> python -m venv venv
> venv\Scripts\activate   # Windows
> source venv/bin/activate # Mac/Linux
> pip install -r requirements.txt
> ```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

```
GOOGLE_CLOUD_VISION_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
N8N_WEBHOOK_URL=your_n8n_webhook_url_here   # leave blank if not using n8n
CHROMA_PERSIST_DIR=./chroma_db
```

### 4. Load the knowledge base into ChromaDB

```bash
python knowledge_base/load_data.py
```

Expected output:
```
Loading knowledge base...
Split into 42 chunks. Embedding now...
Done! 42 chunks stored in ChromaDB at: .../chroma_db
```

### 5. Start the backend server

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

Verify it's running:
```bash
curl http://localhost:8000/
# {"status":"CareerLens AI is running","version":"1.0.0"}

curl http://localhost:8000/health
# {"chroma_ready":true,"document_count":42}
```

### 6. Open the frontend

Option A — Open directly in browser:
```
frontend/index.html
```
Double-click the file in Explorer or Finder.

Option B — Serve with Python (avoids some browser restrictions):
```bash
cd frontend
python -m http.server 3000
```
Then open `http://localhost:3000` in your browser.

> **Note:** Chrome and Edge support Web Speech API. Firefox has limited support. For best results, use **Google Chrome**.

---

## How to Get Your API Keys

### Google Cloud Vision API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project** → name it "CareerLens" → **Create**
3. In the search bar, type **"Cloud Vision API"** → click it → click **Enable**
4. Go to **APIs & Services** → **Credentials**
5. Click **+ Create Credentials** → **API Key**
6. Copy the generated key
7. (Optional but recommended) Click **Restrict Key** → restrict to **Cloud Vision API**
8. Paste the key into your `.env` file as `GOOGLE_CLOUD_VISION_API_KEY`

**Free tier:** 1,000 units/month — sufficient for testing and portfolio demos.

### Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to **API Keys** → **Create Key**
4. Copy the key and paste it into `.env` as `ANTHROPIC_API_KEY`

---

## n8n Automation Setup (Optional)

n8n automates sending the coaching report to the user's email and logging each session to Google Sheets.

### Install n8n

```bash
npm install -g n8n
n8n start
```

Open `http://localhost:5678` in your browser.

### Build the Workflow

1. **Create a new workflow** in n8n
2. **Add a Webhook node:**
   - Method: POST
   - Path: `career-lens`
   - Click **Listen for Test Event** to get the webhook URL
   - Copy the URL and paste it into `.env` as `N8N_WEBHOOK_URL`

3. **Add a Gmail node** (or SMTP):
   - Connect after Webhook
   - To: `{{ $json.email }}`
   - Subject: `Your CareerLens AI Report — Score: {{ $json.overall_score }}/10`
   - Body: Build a formatted HTML email using the fields:
     - `{{ $json.overall_score }}`
     - `{{ $json.strengths.join(', ') }}`
     - `{{ $json.skill_gaps.join(', ') }}`
     - `{{ $json.next_steps.join(', ') }}`
     - `{{ $json.motivational_message }}`

4. **Add a Google Sheets node:**
   - Connect after Gmail
   - Operation: Append Row
   - Columns: `timestamp`, `email`, `job_goal`, `overall_score`, `strengths`, `skill_gaps`

5. **Activate the workflow** using the toggle in the top-right corner

---

## How to Use CareerLens AI

1. **Upload your CV** — take a photo or scan and drag it into the upload zone
2. **Record your goal** — click the microphone button and say something like:
   *"I want to become a data analyst at a fintech company in London"*
3. **Add your email** (optional) to receive the report by email
4. **Click "Analyze My Career"** — the AI will:
   - Extract text from your CV using Google Vision
   - Retrieve relevant job market data from the knowledge base
   - Ask Claude to score your CV and generate detailed coaching
5. **Review your results** — score ring, strengths, skill gaps, improvements, next steps
6. **Click "Hear Your Feedback"** to have the results read aloud

---

## Project Structure

```
career-lens-ai/
├── backend/
│   ├── main.py                  # FastAPI app — API endpoints
│   ├── vision.py                # Google Cloud Vision OCR
│   ├── rag.py                   # LangChain + ChromaDB retrieval
│   ├── ai_coach.py              # Claude API feedback generation
│   ├── automation.py            # n8n webhook trigger
│   ├── requirements.txt
│   ├── .env.example
│   └── knowledge_base/
│       ├── load_data.py         # One-time setup script
│       └── jobs_data.txt        # Job market knowledge base
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
└── README.md
```

---

## API Endpoints

| Method | Endpoint    | Description                                      |
|--------|-------------|--------------------------------------------------|
| GET    | `/`         | Health check — confirms server is running        |
| GET    | `/health`   | ChromaDB status and document count               |
| POST   | `/analyze`  | Main endpoint — accepts CV image + job goal      |

### POST /analyze — Request

```
Content-Type: multipart/form-data

cv_image   : File   (required) — CV image (JPG, PNG, WEBP) or PDF
job_goal   : string (required) — User's target job description
user_email : string (optional) — Email for automation
```

### POST /analyze — Response

```json
{
  "cv_text": "Extracted text from CV...",
  "job_goal": "I want to be a data analyst...",
  "overall_score": 7,
  "score_explanation": "Your CV shows solid experience...",
  "strengths": ["Strong SQL skills", "..."],
  "skill_gaps": ["No Tableau experience", "..."],
  "cv_improvements": ["Add a professional summary", "..."],
  "next_steps": ["Complete Google Data Analytics cert", "..."],
  "motivational_message": "You're already closer than you think!"
}
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `GOOGLE_CLOUD_VISION_API_KEY not set` | Check your `.env` file exists and has the correct key |
| `Could not extract text from image` | Upload a clearer, higher-resolution photo of your CV |
| `ChromaDB not ready` | Run `python knowledge_base/load_data.py` first |
| `Cannot connect to backend` | Make sure `uvicorn main:app --reload --port 8000` is running |
| Voice recording not working | Use Google Chrome or Microsoft Edge; grant microphone permissions |
| n8n webhook not triggering | Check `N8N_WEBHOOK_URL` is set and n8n workflow is activated |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Voice Input | Web Speech API (SpeechRecognition) |
| Text-to-Speech | Web Speech Synthesis API |
| Backend | FastAPI (Python) |
| CV OCR | Google Cloud Vision API |
| Embeddings | Sentence Transformers (all-MiniLM-L6-v2) |
| Vector Store | ChromaDB |
| RAG Framework | LangChain |
| AI Model | Anthropic Claude (claude-sonnet-4-20250514) |
| Automation | n8n (webhooks → Gmail + Google Sheets) |
