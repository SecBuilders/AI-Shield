import logging

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from image_detection import ImageDetector
from phishing_detection import PhishingDetector
from text_detection import TextDetector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI_Shield_Backend")

app = FastAPI(title="AI Shield Backend", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

text_detector = TextDetector()
image_detector = ImageDetector()
phishing_detector = PhishingDetector()


class TextRequest(BaseModel):
    text: str


def _raise_for_detector_error(result: dict):
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "AI Shield backend is running in local-first mode.",
    }


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
    result = text_detector.predict(request.text)
    _raise_for_detector_error(result)
    return result


@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = image_detector.predict(image_bytes)
        _raise_for_detector_error(result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected image detection error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect/phishing")
async def detect_phishing(request: TextRequest):
    result = phishing_detector.predict(request.text)
    _raise_for_detector_error(result)
    return result


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
