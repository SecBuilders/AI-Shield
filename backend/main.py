"""
AI Shield Backend - FastAPI entry point.
Models are pre-loaded in the background on startup so the first
scan request is fast rather than incurring cold-start latency.
"""
import asyncio
import logging

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import time
from typing import Dict

from image_detection import ImageDetector
from phishing_detection import PhishingDetector
from text_detection import TextDetector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI_Shield_Backend")

app = FastAPI(title="AI Shield Backend", version="3.0")

app.add_middleware(
    CORSMiddleware,
    # In production, change to specific domains instead of "*"
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

text_detector = TextDetector()
image_detector = ImageDetector()
phishing_detector = PhishingDetector()

# Basic rate limiting dictionary
RATE_LIMIT_DURATION = 60
MAX_REQUESTS_PER_MINUTE = 100
clients_requests: Dict[str, list] = {}

# Simple heuristic for reverse shells/RCE
MALICIOUS_PATTERNS = [
    r"bash\s+-i", r"nc\s+-e", r"sh\s+-i", 
    r"powershell.*-c", r"cmd\.exe", r"eval\(base64_decode", 
    r"exec\(", r"system\("
]

def check_for_malicious_payload(text: str) -> bool:
    for pattern in MALICIOUS_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False

@app.middleware("http")
async def basic_rate_limit(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    if client_ip not in clients_requests:
        clients_requests[client_ip] = []
        
    # Clean up old requests
    clients_requests[client_ip] = [req_time for req_time in clients_requests[client_ip] if now - req_time < RATE_LIMIT_DURATION]
    
    if len(clients_requests[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
        return status.HTTP_429_TOO_MANY_REQUESTS
        
    clients_requests[client_ip].append(now)
    response = await call_next(request)
    return response


async def _preload(detector, name: str):
    """Load a detector in a worker thread so the event loop is not blocked."""
    try:
        loop = asyncio.get_running_loop()
        load_fn = getattr(detector, "load", None) or getattr(detector, "_load_model", None)
        if load_fn:
            await loop.run_in_executor(None, load_fn)
            logger.info("[OK] %s preloaded", name)
    except Exception as exc:
        logger.warning("Background preload of %s failed: %s", name, exc)


@app.on_event("startup")
async def startup_event():
    """Kick off model loading in the background immediately on server start."""
    logger.info("Starting AI Shield backend - preloading models in background...")
    asyncio.create_task(_preload(text_detector, "TextDetector"))
    asyncio.create_task(_preload(image_detector, "ImageDetector"))
    asyncio.create_task(_preload(phishing_detector, "PhishingDetector"))


class TextRequest(BaseModel):
    text: str


def _raise_for_error(result: dict):
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])


@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Shield v3 running."}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "detectors": {
            "text_loaded": text_detector.is_ready(),
            "image_loaded": image_detector.is_ready(),
            "phishing_loaded": phishing_detector.is_ready(),
        },
    }


@app.post("/detect/text")
async def detect_text(request: TextRequest):
    if check_for_malicious_payload(request.text):
         raise HTTPException(status_code=403, detail="Potential malicious payload detected (RCE/Reverse Shell string signature).")
         
    result = text_detector.predict(request.text)
    _raise_for_error(result)
    return result


MAX_FILE_SIZE = 5 * 1024 * 1024 # 5 MB limits to prevent storage exhaustion/DOS

@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    try:
        # Validate that uploaded file claims to be an image
        if not file.content_type or not file.content_type.startswith("image/"):
             raise HTTPException(status_code=400, detail="Invalid file format. Only images allowed.")
             
        image_bytes = await file.read()
        
        # Prevent oversized files
        if len(image_bytes) > MAX_FILE_SIZE:
             raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")
             
        result = image_detector.predict(image_bytes)
        _raise_for_error(result)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected image detection error")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/detect/phishing")
async def detect_phishing(request: TextRequest):
    result = phishing_detector.predict(request.text)
    _raise_for_error(result)
    return result


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=False)
