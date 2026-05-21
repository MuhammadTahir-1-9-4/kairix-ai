import json
import os

from groq import Groq
from dotenv import load_dotenv

load_dotenv()

BASE_SYSTEM_PROMPT = """You are CareerLens AI, an expert career coach and senior talent acquisition specialist with 20 years of experience across tech, finance, marketing, healthcare, and creative industries worldwide.

Analyse the candidate's CV against their stated career goal, then produce a detailed, honest, and actionable coaching report. Be specific — generic advice is useless. Reference actual content from their CV.

RESOURCES RULE: For recommended_resources, ONLY use real, widely-known platforms: Coursera, LinkedIn Learning, Udemy, YouTube, freeCodeCamp, official documentation, Google/IBM/Meta/AWS/Microsoft certifications. NEVER invent book titles or author names. Format each as: "Platform/Course Name — reason it closes a specific gap".

Respond ONLY in this exact JSON format — no text before or after, no markdown fences:
{
  "overall_score": <integer 1-10>,
  "score_explanation": "<2 specific sentences explaining the score based on what you actually see in the CV>",
  "strengths": ["<specific strength from CV 1>", "<strength 2>", "<strength 3>", "<strength 4>", "<strength 5>"],
  "skill_gaps": ["<specific gap vs target role 1>", "<gap 2>", "<gap 3>", "<gap 4>", "<gap 5>"],
  "cv_improvements": ["<specific CV change 1>", "<change 2>", "<change 3>", "<change 4>", "<change 5>"],
  "next_steps": ["<concrete actionable step this week 1>", "<step 2>", "<step 3>"],
  "interview_questions": ["<likely interview question for this role 1>", "<question 2>", "<question 3>"],
  "recommended_resources": ["<resource name — exactly why it closes a specific gap>", "<resource 2 — why>", "<resource 3 — why>", "<resource 4 — why>", "<resource 5 — why>"],
  "motivational_message": "<1 personalised, encouraging sentence referencing their specific goal>"
}"""

JD_SYSTEM_PROMPT = """You are CareerLens AI, an expert career coach, senior recruiter, and ATS specialist with 20 years of experience. You have deep expertise in keyword-based CV screening and ATS (Applicant Tracking System) optimisation.

Analyse the candidate's CV against BOTH their career goal AND the specific job description provided. Simulate a realistic ATS keyword match analysis — identify which important keywords from the JD appear in the CV and which do not. Be specific and honest.

RESOURCES RULE: For recommended_resources, ONLY use real, widely-known platforms: Coursera, LinkedIn Learning, Udemy, YouTube, freeCodeCamp, official documentation, Google/IBM/Meta/AWS/Microsoft certifications. NEVER invent book titles or author names. Format each as: "Platform/Course Name — reason it closes a specific gap".

Respond ONLY in this exact JSON format — no text before or after, no markdown fences:
{
  "overall_score": <integer 1-10, score against THIS specific job>,
  "score_explanation": "<2 specific sentences explaining fit against this particular role>",
  "strengths": ["<specific strength relevant to this JD 1>", "<strength 2>", "<strength 3>", "<strength 4>", "<strength 5>"],
  "skill_gaps": ["<specific gap vs this JD 1>", "<gap 2>", "<gap 3>", "<gap 4>", "<gap 5>"],
  "cv_improvements": ["<specific CV change to better match this JD 1>", "<change 2>", "<change 3>", "<change 4>", "<change 5>"],
  "next_steps": ["<concrete actionable step this week 1>", "<step 2>", "<step 3>"],
  "interview_questions": ["<likely interview question from this specific JD 1>", "<question 2>", "<question 3>"],
  "recommended_resources": ["<specific resource — exactly why it helps for this role>", "<resource 2 — why>", "<resource 3 — why>"],
  "motivational_message": "<1 personalised, encouraging sentence referencing their goal and this specific role>",
  "jd_match": {
    "match_score": <integer 0-100, realistic ATS keyword match percentage based on keyword overlap>,
    "matched_keywords": ["<important keyword from JD found in CV>", "<more keywords...>"],
    "missing_keywords": ["<important keyword in JD NOT found in CV>", "<more keywords...>"],
    "ats_verdict": "<exactly one of: 'Strong Match' | 'Moderate Match' | 'Weak Match'>",
    "jd_advice": ["<specific change to CV to better pass ATS for this JD>", "<change 2>", "<change 3>"]
  }
}

For matched_keywords and missing_keywords: include 4–8 of the most important technical skills, tools, and role-specific terms from the JD. Focus on hard skills and technologies, not soft skills."""

FALLBACK_FEEDBACK = {
    "overall_score": 5,
    "score_explanation": (
        "We were unable to fully process your CV at this time. "
        "Please try again or ensure your CV image is clear and readable."
    ),
    "strengths": [
        "You took the initiative to seek career coaching — that's a great first step.",
        "You have a defined career goal, which helps focus your job search.",
        "Reaching out for feedback shows a growth mindset.",
        "Actively improving your CV gives you an advantage over passive job seekers.",
        "Your willingness to invest in career development is a positive signal to employers.",
    ],
    "skill_gaps": [
        "Unable to assess skill gaps without complete CV data — please retry.",
        "Consider listing technical skills explicitly on your CV.",
        "Ensure your CV clearly shows measurable achievements with numbers.",
        "Add a professional summary at the top tailored to your target role.",
        "Make sure each role lists impact, not just responsibilities.",
    ],
    "cv_improvements": [
        "Re-upload a clearer version of your CV and try again.",
        "Use a clean, ATS-friendly format with standard section headings.",
        "Add a Skills section with comma-separated relevant keywords.",
        "Quantify at least 3 achievements with specific numbers or percentages.",
        "Include a targeted professional summary at the top of your CV.",
    ],
    "next_steps": [
        "Re-upload a clearer version of your CV to get a full analysis.",
        "Research the top 10 skills required for your target role.",
        "Update your LinkedIn profile to match your target job title.",
    ],
    "interview_questions": [
        "Tell me about yourself and why you're interested in this role.",
        "What's your greatest professional achievement so far?",
        "Where do you see yourself in three years?",
    ],
    "recommended_resources": [
        "LinkedIn Learning — broad skill development library for most career paths.",
        "Coursera — accredited certifications from Google, IBM, and top universities.",
        "Your target company's careers page — read job descriptions to identify skill priorities.",
    ],
    "motivational_message": (
        "Every expert was once a beginner — your commitment to improving is already setting you apart."
    ),
}


def generate_feedback(cv_text: str, job_goal: str, rag_context: str, job_description: str = "") -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("⚠️  GROQ_API_KEY not set. Returning fallback feedback.")
        return FALLBACK_FEEDBACK

    has_jd = bool(job_description and job_description.strip())
    system_prompt = JD_SYSTEM_PROMPT if has_jd else BASE_SYSTEM_PROMPT

    user_message = (
        f"CANDIDATE'S CV TEXT:\n{cv_text}\n\n"
        f"CANDIDATE'S JOB GOAL:\n{job_goal}\n\n"
        f"RELEVANT MARKET CONTEXT FROM KNOWLEDGE BASE:\n{rag_context}\n\n"
    )
    if has_jd:
        user_message += f"JOB DESCRIPTION TO MATCH AGAINST:\n{job_description}\n\n"

    user_message += "Please analyse this CV and provide your coaching report now."

    try:
        client = Groq(api_key=api_key)

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2500,
            temperature=0.3,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )

        raw_text = completion.choices[0].message.content.strip()

        json_start = raw_text.find("{")
        json_end = raw_text.rfind("}") + 1
        if json_start == -1 or json_end == 0:
            raise ValueError("No JSON object found in Groq response.")

        feedback = json.loads(raw_text[json_start:json_end])
        return feedback

    except json.JSONDecodeError as exc:
        print(f"⚠️  JSON parse error from Groq response: {exc}")
        return FALLBACK_FEEDBACK
    except Exception as exc:
        print(f"⚠️  Groq API error: {exc}")
        return FALLBACK_FEEDBACK
