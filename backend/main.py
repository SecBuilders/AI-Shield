from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging
import sys
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Imports (files are now in same directory)
from text_detection import TextDetector
from image_detection import ImageDetector
from phishing_detection import PhishingDetector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI_Shield_Backend")

app = FastAPI(title="AI Shield Backend", version="1.0")

# CORS Configuration
origins = [
    "*", # Allow all for local extension testing
    "chrome-extension://*", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Detectors (now lightweight API wrappers)
text_detector = TextDetector()
image_detector = ImageDetector()
phishing_detector = PhishingDetector()

class TextRequest(BaseModel):
    text: str

@app.get("/")
async def root():
    return {"status": "AI Shield Backend is Running (Cloud Mode)"}

@app.post("/detect/text")
async def detect_text(request: TextRequest):
    result = text_detector.predict(request.text)
    if "error" in result:
        # If model is loading, it sends an error. Return 503 so client retires.
        if "loading" in str(result["error"]).lower():
             raise HTTPException(status_code=503, detail="Model is cold starting, please try again in 10s.")
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = image_detector.predict(image_bytes)
        if "error" in result:
             if "loading" in str(result["error"]).lower():
                 raise HTTPException(status_code=503, detail="Model is cold starting, please try again in 10s.")
             raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/phishing")
async def detect_phishing(request: TextRequest):
    result = phishing_detector.predict(request.text)
    if "error" in result:
        if "loading" in str(result["error"]).lower():
             raise HTTPException(status_code=503, detail="Model is cold starting, please try again in 10s.")
        raise HTTPException(status_code=400, detail=result["error"])
    return result

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
