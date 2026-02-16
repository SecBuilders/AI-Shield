# AI Shield

AI Shield is a Chrome extension with a local-first Python backend for:
- AI-generated text detection
- AI/deepfake image detection
- phishing email/message detection

## Project Structure

- `backend/` FastAPI service with local ML detectors
- `extension/` Chrome extension popup + content script

## Quick Start

1. Install backend dependencies:
```bash
pip install -r backend/requirements.txt
```
2. Run backend:
```bash
cd backend
python main.py
```
3. Load extension in Chrome:
- Open `chrome://extensions`
- Enable `Developer mode`
- Click `Load unpacked`
- Select the `extension/` folder

## Notes

- `.env` is optional. The backend works without API keys.
- First run downloads model files from Hugging Face, so the first scan is slower.
- Backend API runs at `http://127.0.0.1:8000` by default.
