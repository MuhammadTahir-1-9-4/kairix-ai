import asyncio
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import vision
import rag
import ai_coach
import automation

app = FastAPI(title="CareerLens AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "CareerLens AI is running", "version": "1.0.0"}


@app.get("/health")
def health():
    try:
        from langchain_community.vectorstores import Chroma
        from langchain_community.embeddings import HuggingFaceEmbeddings

        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        persist_dir = os.path.normpath(os.path.join(backend_dir, persist_dir))

        if not os.path.exists(persist_dir):
            return {"chroma_ready": False, "document_count": 0}

        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        vectorstore = Chroma(
            collection_name="career_knowledge",
            embedding_function=embeddings,
            persist_directory=persist_dir,
        )
        count = vectorstore._collection.count()
        return {"chroma_ready": count > 0, "document_count": count}

    except Exception as exc:
        print(f"⚠️  Health check error: {exc}")
        return {"chroma_ready": False, "document_count": 0}


@app.post("/analyze")
async def analyze(
    cv_image: UploadFile = File(...),
    job_goal: str = Form(...),
    user_email: str = Form(""),
    job_description: str = Form(""),
):
    image_bytes = await cv_image.read()

    print("📷 Validating image...")
    if not vision.is_valid_image(image_bytes):
        raise HTTPException(
            status_code=400,
            detail="Invalid image. File must be between 1 KB and 10 MB.",
        )

    print("📷 Extracting CV text via Google Vision...")
    try:
        cv_text = vision.extract_text_from_image(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        print(f"❌ Vision extraction failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Failed to extract text from your CV image. Please try again.",
        )

    print("🧠 Retrieving relevant career context from knowledge base...")
    try:
        rag_context = rag.retrieve_career_context(job_goal)
    except Exception as exc:
        print(f"⚠️  RAG retrieval failed, using fallback: {exc}")
        rag_context = (
            "General career advice: Focus on measurable achievements, tailor your CV, "
            "and highlight transferable skills."
        )

    print("🤖 Generating AI career feedback with Groq...")
    try:
        feedback = ai_coach.generate_feedback(cv_text, job_goal, rag_context, job_description)
    except Exception as exc:
        print(f"❌ AI feedback generation failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate career feedback. Please try again.",
        )

    print("📬 Sending email report and logging to Google Sheets...")
    asyncio.create_task(automation.send_email(user_email, job_goal, feedback))
    asyncio.create_task(automation.send_to_n8n(user_email, job_goal, feedback))

    print("✅ Analysis complete. Returning results.")
    return {
        "cv_text": cv_text,
        "job_goal": job_goal,
        **feedback,
    }
