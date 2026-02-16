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


def run():
    print("Testing Text Detector (Local)...")
    td = TextDetector()
    print(td.predict("This paragraph was written by a student in class."))

    print("\nTesting Phishing Detector (Local)...")
    pd = PhishingDetector()
    print(pd.predict("Urgent: verify your account now at http://bit.ly/security-check"))

    print("\nTesting Image Detector (Local)...")
    idet = ImageDetector()
    sample_image_bytes = build_test_image_bytes()
    print(idet.predict(sample_image_bytes))

    print("\n[OK] Verification complete.")


if __name__ == "__main__":
    run()
