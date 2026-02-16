import os
import logging
from io import BytesIO
from typing import Dict, List

import torch
from PIL import Image, UnidentifiedImageError
from transformers import pipeline

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ImageDetector:
    def __init__(self):
        self.model_id = "umm-maybe/AI-image-detector"
        self.classifier = None

    def is_ready(self) -> bool:
        return self.classifier is not None

    def _load_model(self):
        if self.classifier is not None:
            return

        device = 0 if torch.cuda.is_available() else -1
        self.classifier = pipeline(
            "image-classification",
            model=self.model_id,
            device=device,
            top_k=5,
        )

    @staticmethod
    def _normalize_label(raw_label: str) -> str:
        label = raw_label.strip().lower()
        if any(token in label for token in ("human", "real", "authentic")):
            return "Real Image"
        if any(token in label for token in ("ai", "fake", "artificial", "generated", "deepfake")):
            return "AI-Generated/Deepfake"
        return "AI-Generated/Deepfake"

    def predict(self, image_bytes: bytes):
        if not image_bytes:
            return {"error": "Empty image"}

        try:
            image = Image.open(BytesIO(image_bytes)).convert("RGB")
        except UnidentifiedImageError:
            return {"error": "Unsupported or corrupted image file"}
        except Exception as e:
            logger.error(f"Image parse error: {e}")
            return {"error": "Failed to parse image"}

        try:
            self._load_model()
        except Exception as e:
            logger.error(f"Failed to load image model: {e}")
            return {"error": "Image model failed to load"}

        try:
            results = self.classifier(image)
        except Exception as e:
            logger.error(f"Image prediction error: {e}")
            return {"error": "Image detection failed"}

        items: List[Dict] = results if isinstance(results, list) else [results]
        score_map: Dict[str, float] = {"Real Image": 0.0, "AI-Generated/Deepfake": 0.0}
        for item in items:
            label = self._normalize_label(item["label"])
            score_map[label] = max(score_map[label], float(item["score"]))

        final_label = max(score_map, key=score_map.get)
        confidence = score_map[final_label]

        return {
            "label": final_label,
            "confidence": round(confidence * 100, 2),
            "raw_result": {k: round(v * 100, 2) for k, v in score_map.items()},
        }
