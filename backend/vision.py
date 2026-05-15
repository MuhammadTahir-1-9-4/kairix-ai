import base64
import io
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"


def is_valid_image(image_bytes: bytes) -> bool:
    size = len(image_bytes)
    return 1_024 <= size <= 10 * 1_024 * 1_024


def _is_pdf(image_bytes: bytes) -> bool:
    return image_bytes[:4] == b"%PDF"


def _extract_text_from_pdf(image_bytes: bytes) -> str:
    import pdfplumber

    text_parts = []
    with pdfplumber.open(io.BytesIO(image_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())

    result = "\n\n".join(text_parts).strip()
    if not result:
        raise ValueError(
            "Could not extract text from PDF. Make sure the PDF contains selectable text, "
            "not a scanned image. For scanned CVs, please upload a JPG or PNG photo instead."
        )
    return result


def _extract_text_from_image_bytes(image_bytes: bytes) -> str:
    api_key = os.getenv("GOOGLE_CLOUD_VISION_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_CLOUD_VISION_API_KEY is not set in environment variables.")

    encoded = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "requests": [
            {
                "image": {"content": encoded},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION", "maxResults": 1}],
            }
        ]
    }

    try:
        response = httpx.post(
            f"{VISION_API_URL}?key={api_key}",
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        annotation = (
            data.get("responses", [{}])[0]
            .get("fullTextAnnotation", {})
            .get("text", "")
            .strip()
        )

        if not annotation:
            raise ValueError(
                "Could not extract text from image. Please upload a clearer photo."
            )

        return annotation

    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"Google Vision API error: {exc.response.status_code} — {exc.response.text}"
        ) from exc
    except httpx.RequestError as exc:
        raise ValueError(f"Network error contacting Google Vision API: {exc}") from exc


def extract_text_from_image(image_bytes: bytes) -> str:
    if _is_pdf(image_bytes):
        print("📄 PDF detected — extracting text directly (no Vision API needed).")
        return _extract_text_from_pdf(image_bytes)
    return _extract_text_from_image_bytes(image_bytes)
