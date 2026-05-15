import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()


async def send_to_n8n(user_email: str, job_goal: str, feedback: dict) -> bool:
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()

    if not webhook_url:
        print("ℹ️  N8N_WEBHOOK_URL not configured — skipping automation.")
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
            print(f"✅ n8n webhook triggered successfully for {user_email or 'anonymous'}.")
            return True

    except httpx.HTTPStatusError as exc:
        print(
            f"⚠️  n8n webhook HTTP error: {exc.response.status_code} — {exc.response.text}"
        )
        return False
    except httpx.RequestError as exc:
        print(f"⚠️  n8n webhook network error: {exc}")
        return False
    except Exception as exc:
        print(f"⚠️  Unexpected error sending to n8n: {exc}")
        return False
