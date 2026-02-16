import os
import logging
from typing import Dict, List

import torch
from transformers import pipeline

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TextDetector:
    def __init__(self):
        self.model_id = "fakespot-ai/roberta-base-ai-text-detection-v1"
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
    def _split_text(text: str, max_words: int = 400) -> List[str]:
        words = text.split()
        return [" ".join(words[i : i + max_words]) for i in range(0, len(words), max_words)]

    @staticmethod
    def _normalize_label(raw_label: str) -> str:
        label = raw_label.strip().lower()
        if "fake" in label or label in {"ai", "ai-generated", "label_1"}:
            return "AI-Generated"
        return "Human-Written"

    def predict(self, text: str):
        if not text or not text.strip():
            return {"error": "Empty text"}

        try:
            self._load_model()
        except Exception as e:
            logger.error(f"Failed to load text model: {e}")
            return {"error": "Text model failed to load"}

        clean_text = self._clean_text(text)
        chunks = self._split_text(clean_text)
        if not chunks:
            return {"error": "Empty text"}

        try:
            results = self.classifier(chunks)
        except Exception as e:
            logger.error(f"Text prediction error: {e}")
            return {"error": "Text detection failed"}

        score_map: Dict[str, float] = {"Human-Written": 0.0, "AI-Generated": 0.0}
        for chunk_result in results:
            items = chunk_result if isinstance(chunk_result, list) else [chunk_result]
            for item in items:
                label = self._normalize_label(item["label"])
                score_map[label] += float(item["score"])

        chunk_count = max(len(results), 1)
        score_map = {label: value / chunk_count for label, value in score_map.items()}

        final_label = max(score_map, key=score_map.get)
        confidence = score_map[final_label]

        return {
            "label": final_label,
            "confidence": round(confidence * 100, 2),
            "raw_result": {k: round(v * 100, 2) for k, v in score_map.items()},
        }
