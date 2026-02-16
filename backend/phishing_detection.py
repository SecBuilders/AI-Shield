import requests
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PhishingDetector:
    def __init__(self):
        # Using router.huggingface.co with mrm8488 spam model
        self.api_url = "https://router.huggingface.co/hf-inference/models/mrm8488/bert-tiny-finetuned-sms-spam-detection"
        self.api_key = os.getenv("HF_API_KEY")

    def predict(self, text: str):
        if not text:
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
            
            results = response.json()
            
            if isinstance(results, dict) and "error" in results:
                 return {"error": f"Model loading: {results.get('error')}"}

            # Model labels: LABEL_0 (Ham/Legit), LABEL_1 (Spam/Phishing) for mrm8488
            # Flatten result
            scores = results[0]
            top_result = max(scores, key=lambda x: x['score'])
            
            label = top_result['label']
            score = top_result['score']
            
            # Map LABEL_1 or 'spam' to Phishing
            if label == 'LABEL_1' or 'spam' in label.lower():
                prediction = "Phishing/Spam Attempt"
            else:
                prediction = "Legitimate"

            return {
                "label": prediction,
                "confidence": round(score * 100, 2)
            }

        except Exception as e:
            logger.error(f"Phishing API Error: {e}")
            return {"error": "AI Service Unavailable"}
