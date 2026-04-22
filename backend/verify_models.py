from io import BytesIO

from PIL import Image

from image_detection import ImageDetector
from phishing_detection import PhishingDetector
from text_detection import TextDetector


def build_test_image_bytes() -> bytes:
    image = Image.new("RGB", (256, 256), (255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _report_result(name: str, result: dict) -> bool:
    print(f"Testing {name}...")
    print(result)
    return "error" not in result


def run() -> bool:
    results_ok = []
    sample_text = (
        "This paragraph was written by a student in class while explaining a simple topic in a normal way. "
        "It uses plain language, varies sentence length a little, and stays focused on a single idea. "
        "The goal is not to sound polished or artificial, but simply to communicate clearly with enough words "
        "for the detector to judge the style with reasonable confidence."
    )

    text_detector = TextDetector()
    results_ok.append(
        _report_result(
            "Text Detector (Local)",
            text_detector.predict(sample_text),
        )
    )

    phishing_detector = PhishingDetector()
    results_ok.append(
        _report_result(
            "Phishing Detector (Local)",
            phishing_detector.predict("Urgent: verify your account now at http://bit.ly/security-check"),
        )
    )

    image_detector = ImageDetector()
    sample_image_bytes = build_test_image_bytes()
    results_ok.append(
        _report_result(
            "Image Detector (Local)",
            image_detector.predict(sample_image_bytes),
        )
    )

    print("\n[OK] Verification complete." if all(results_ok) else "\n[WARN] Verification completed with failures.")
    return all(results_ok)


if __name__ == "__main__":
    raise SystemExit(0 if run() else 1)
