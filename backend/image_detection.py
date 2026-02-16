import requests
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImageDetector:
    def __init__(self):
        # Switched to umm-maybe/AI-image-detector on router
        self.api_url = "https://router.huggingface.co/hf-inference/models/umm-maybe/AI-image-detector"
        self.api_key = os.getenv("HF_API_KEY")

    def predict(self, image_bytes: bytes):
        if not image_bytes:
             return {"error": "Empty image"}

        if not self.api_key:
             return {"error": "API Key missing. Check .env file."}

        headers = {"Authorization": f"Bearer {self.api_key}"}

        try:
            response = requests.post(self.api_url, headers=headers, data=image_bytes)
            response.raise_for_status()
            
            results = response.json()
            
             # Handle 503 or warnings
            if isinstance(results, dict) and "error" in results:
                 return {"error": f"Model loading: {results.get('error')}"}

            # Result: [{'label': 'real', 'score': 0.98}, {'label': 'fake', 'score': 0.02}]
            top_result = max(results, key=lambda x: x['score'])
            
            label = top_result['label']
            score = top_result['score']
            
            # Model specific labels check
            if "real" in label.lower():
                 prediction = "Real Image"
            else:
                 prediction = "AI-Generated/Deepfake"

            return {
                "label": prediction,
                "confidence": round(score * 100, 2)
            }

        except Exception as e:
            logger.error(f"Image API Error: {e}")
            return {"error": "AI Service Unavailable"}
