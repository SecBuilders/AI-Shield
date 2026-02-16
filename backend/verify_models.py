import sys
import os
from dotenv import load_dotenv

load_dotenv()

# Files are in the same directory now
# sys.path.append(os.path.join(os.path.dirname(__file__), "AI TEXT"))

if not os.getenv("HF_API_KEY"):
    print("[FAIL] HF_API_KEY missing in .env file. Please create it first.")
    exit(1)

try:
    print("Testing Text Detector (Cloud)...")
    from text_detection import TextDetector
    td = TextDetector()
    print(td.predict("This is a test sentence."))

    print("\nTesting Phishing Detector (Cloud)...")
    from phishing_detection import PhishingDetector
    pd = PhishingDetector()
    print(pd.predict("http://google.com"))

    print("\nTesting Image Detector (Cloud - Init only)...")
    from image_detection import ImageDetector
    id = ImageDetector()
    print("Image Detector initialized.")

    print("\n[OK] Verification Complete. Cloud API is accessible.")

except Exception as e:
    print(f"\n[FAIL] Verification failed: {e}")
