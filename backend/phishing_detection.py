import os
import logging
import re
from typing import Dict, List

import torch
from transformers import pipeline

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PhishingDetector:
    def __init__(self):
        self.model_id = "dima806/phishing-email-detection"
        self.classifier = None

    def is_ready(self) -> bool:
        return self.classifier is not None

    def _load_model(self):
        if self.classifier is not None:
            return

        device = 0 if torch.cuda.is_available() else -1
        self.classifier = pipeline(
            "text-classification",
            model=self.model_id,
            device=device,
            truncation=True,
            max_length=512,
            top_k=None,
        )

    @staticmethod
    def _clean_text(text: str) -> str:
        return text.replace("\n", " ").strip()

    @staticmethod
    def _heuristic_risk(text: str) -> float:
        lower = text.lower()
        risk = 0.0

        risk_keywords = [
            "verify your account",
            "update your payment",
            "suspended",
            "urgent",
            "click here",
            "confirm password",
            "otp",
            "bank account",
            "wire transfer",
            "gift card",
            "reset your password",
            "unauthorized login",
        ]
        for keyword in risk_keywords:
            if keyword in lower:
                risk += 0.12

        if re.search(r"https?://", lower):
            risk += 0.08
        if re.search(r"https?://(bit\.ly|tinyurl\.com|t\.co|rb\.gy|shorturl)", lower):
            risk += 0.2
        if re.search(r"https?://\d+\.\d+\.\d+\.\d+", lower):
            risk += 0.2
        if re.search(r"@\w+\.(ru|cn|tk|top|xyz)\b", lower):
            risk += 0.15

        exclamations = text.count("!")
        if exclamations >= 3:
            risk += 0.08

        alnum_chars = [ch for ch in text if ch.isalpha()]
        if alnum_chars:
            upper_ratio = sum(1 for ch in alnum_chars if ch.isupper()) / len(alnum_chars)
            if upper_ratio > 0.4:
                risk += 0.12

        return max(0.0, min(0.98, risk))

    @staticmethod
    def _score_from_model_items(items: List[Dict]) -> Dict[str, float]:
        scores = {"Legitimate": 0.0, "Phishing/Spam Attempt": 0.0}
        for item in items:
            label = item["label"].strip().lower()
            score = float(item["score"])
            if "phishing" in label or "spam" in label:
                scores["Phishing/Spam Attempt"] = max(scores["Phishing/Spam Attempt"], score)
            elif any(token in label for token in ("safe", "save", "ham", "legit")):
                scores["Legitimate"] = max(scores["Legitimate"], score)

        if scores["Legitimate"] == 0.0 and scores["Phishing/Spam Attempt"] == 0.0 and items:
            top = max(items, key=lambda x: float(x.get("score", 0)))
            label = top["label"].strip().lower()
            if "phishing" in label or "spam" in label:
                scores["Phishing/Spam Attempt"] = float(top["score"])
            else:
                scores["Legitimate"] = float(top["score"])

        total = scores["Legitimate"] + scores["Phishing/Spam Attempt"]
        if total > 0:
            scores = {k: v / total for k, v in scores.items()}
        else:
            scores = {"Legitimate": 0.5, "Phishing/Spam Attempt": 0.5}
        return scores

    def predict(self, text: str):
        if not text or not text.strip():
            return {"error": "Empty text"}

        clean_text = self._clean_text(text)
        heuristic_risk = self._heuristic_risk(clean_text)
        heuristic_scores = {
            "Legitimate": 1.0 - heuristic_risk,
            "Phishing/Spam Attempt": heuristic_risk,
        }

        try:
            self._load_model()
            raw = self.classifier(clean_text)
            items = raw[0] if isinstance(raw, list) and raw and isinstance(raw[0], list) else raw
            items = items if isinstance(items, list) else [items]
            model_scores = self._score_from_model_items(items)
        except Exception as e:
            logger.error(f"Phishing model inference failed, using heuristic fallback: {e}")
            model_scores = heuristic_scores

        combined_scores = {
            "Legitimate": (model_scores["Legitimate"] * 0.8) + (heuristic_scores["Legitimate"] * 0.2),
            "Phishing/Spam Attempt": (model_scores["Phishing/Spam Attempt"] * 0.8)
            + (heuristic_scores["Phishing/Spam Attempt"] * 0.2),
        }

        final_label = max(combined_scores, key=combined_scores.get)
        confidence = combined_scores[final_label]

        return {
            "label": final_label,
            "confidence": round(confidence * 100, 2),
            "raw_result": {k: round(v * 100, 2) for k, v in combined_scores.items()},
        }
