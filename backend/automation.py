import asyncio
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from dotenv import load_dotenv

load_dotenv()


def _build_email_html(job_goal: str, feedback: dict) -> str:
    def list_items(items):
        return "".join(f"<li>{item}</li>" for item in (items or []))

    def resource_items(resources):
        items = []
        for r in (resources or []):
            if isinstance(r, dict):
                items.append(f"<li><b>{r.get('name', '')}</b> — {r.get('why', '')}</li>")
            else:
                items.append(f"<li>{r}</li>")
        return "".join(items)

    jd_match = feedback.get("jd_match")
    jd_section = ""
    if jd_match and jd_match.get("match_score"):
        jd_section = f"""
        <h3>🎯 JD Match Score: {jd_match.get('match_score')}%</h3>
        <p><b>ATS Verdict:</b> {jd_match.get('ats_verdict', '')}</p>
        """

    return f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #333;">
    <h2 style="color: #6366f1;">🎓 CareerLens AI Report</h2>
    <p><b>Job Goal:</b> {job_goal}</p>
    <h3>Score: {feedback.get('overall_score', 'N/A')}/10</h3>
    <p>{feedback.get('score_explanation', '')}</p>
    {jd_section}
    <h3>✅ Strengths</h3>
    <ul>{list_items(feedback.get('strengths'))}</ul>
    <h3>⚡ Skill Gaps</h3>
    <ul>{list_items(feedback.get('skill_gaps'))}</ul>
    <h3>📝 CV Improvements</h3>
    <ul>{list_items(feedback.get('cv_improvements'))}</ul>
    <h3>🎯 Next Steps</h3>
    <ol>{list_items(feedback.get('next_steps'))}</ol>
    <h3>💬 Likely Interview Questions</h3>
    <ol>{list_items(feedback.get('interview_questions'))}</ol>
    <h3>📚 Recommended Resources</h3>
    <ul>{resource_items(feedback.get('recommended_resources'))}</ul>
    <p><i>"{feedback.get('motivational_message', '')}"</i></p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="color: #aaa; font-size: 12px;">Powered by CareerLens AI &middot; Llama 3.3 &middot; Google Vision &middot; RAG Intelligence</p>
    </body></html>
    """


def _send_email_sync(user_email: str, job_goal: str, feedback: dict) -> bool:
    sender = os.getenv("GMAIL_SENDER", "").strip()
    app_password = os.getenv("GMAIL_APP_PASSWORD", "").strip()
    print(f"📧 Email task started — sender: '{sender}', recipient: '{user_email}', app_pwd set: {bool(app_password)}")

    if not sender or not app_password:
        print("ℹ️  Gmail credentials not configured — skipping email.")
        return True

    if not user_email:
        print("ℹ️  No recipient email — skipping email.")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🎓 Your CareerLens AI Report — {job_goal}"
        msg["From"] = f"CareerLens AI <{sender}>"
        msg["To"] = user_email
        msg.attach(MIMEText(_build_email_html(job_goal, feedback), "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(sender, app_password)
            smtp.sendmail(sender, user_email, msg.as_string())

        print(f"✅ Email sent to {user_email}")
        return True

    except Exception as exc:
        print(f"⚠️  Email sending failed: {exc}")
        return False


async def send_email(user_email: str, job_goal: str, feedback: dict) -> bool:
    try:
        return await asyncio.to_thread(_send_email_sync, user_email, job_goal, feedback)
    except Exception as exc:
        print(f"⚠️  Email task error: {exc}")
        return False


async def send_to_n8n(user_email: str, job_goal: str, feedback: dict) -> bool:
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()

    if not webhook_url:
        print("ℹ️  N8N_WEBHOOK_URL not configured — skipping Google Sheets logging.")
        return True

    payload = {
        "email": user_email,
        "job_goal": job_goal,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_score": feedback.get("overall_score"),
        "score_explanation": feedback.get("score_explanation", ""),
        "strengths": feedback.get("strengths", []),
        "skill_gaps": feedback.get("skill_gaps", []),
        "cv_improvements": feedback.get("cv_improvements", []),
        "next_steps": feedback.get("next_steps", []),
        "interview_questions": feedback.get("interview_questions", []),
        "recommended_resources": feedback.get("recommended_resources", []),
        "motivational_message": feedback.get("motivational_message", ""),
        "jd_match_score": (feedback.get("jd_match") or {}).get("match_score"),
        "jd_ats_verdict": (feedback.get("jd_match") or {}).get("ats_verdict", ""),
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(webhook_url, json=payload)
            response.raise_for_status()
            print(f"✅ Google Sheets logged for {user_email or 'anonymous'}.")
            return True

    except httpx.HTTPStatusError as exc:
        print(f"⚠️  n8n webhook HTTP error: {exc.response.status_code} — {exc.response.text}")
        return False
    except httpx.RequestError as exc:
        print(f"⚠️  n8n webhook network error: {exc}")
        return False
    except Exception as exc:
        print(f"⚠️  Unexpected error sending to n8n: {exc}")
        return False
