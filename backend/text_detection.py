import requests
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TextDetector:
    def __init__(self):
        # Using router.huggingface.co as api-inference is deprecated
        self.api_url = "https://router.huggingface.co/hf-inference/models/openai-community/roberta-base-openai-detector"
        self.api_key = os.getenv("HF_API_KEY")
        if not self.api_key:
            logger.warning("HF_API_KEY not found in environment variables. result will be mocked or fail.")

    def predict(self, text: str):
        if not text or not text.strip():
            return {"error": "Empty text"}

        if not self.api_key:
             return {"error": "API Key missing. Check .env file."}

        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {"inputs": text}

        try:
            response = requests.post(self.api_url, headers=headers, json=payload)
            if response.status_code != 200:
                logger.error(f"API Error Response: {response.text}")
            response.raise_for_status()
            
            # HF API returns list of lists for classification: [[{'label': 'Real', 'score': 0.99}, ...]]
            results = response.json()
            
            if isinstance(results, dict) and "error" in results:
                return {"error": f"Model loading: {results.get('error')}"}

            # roberta-base-openai-detector labels: 'Real' (Human), 'Fake' (AI)
            # Flatten result
            scores = results[0]
            top_result = max(scores, key=lambda x: x['score'])
            
            label = top_result['label']
            score = top_result['score']
            
            if label == 'Fake':
                prediction = "AI-Generated"
            else:
                prediction = "Human-Written"

            return {
                "label": prediction,
                "confidence": round(score * 100, 2),
                "raw_result": scores
            }

        except Exception as e:
            logger.error(f"Text API Error: {e}")
            return {"error": "AI Service Unavailable"}
