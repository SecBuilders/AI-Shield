# AI Shield Backend

FastAPI backend for the AI Shield browser extension.

## What It Does

- Detects AI-written text
- Detects likely AI-generated images / deepfakes
- Flags phishing-style URLs, emails, and messages

## Run It

```bash
pip install -r requirements.txt
python main.py
```

The API listens on `http://127.0.0.1:8080`.

## Endpoints

- `GET /` basic status
- `GET /health` detector readiness
- `POST /detect/text` with JSON `{ "text": "..." }`
- `POST /detect/image` with multipart form field `file`
- `POST /detect/phishing` with JSON `{ "text": "..." }`

## Model Behavior

- Detectors try to load local Hugging Face models when available.
- If a model cannot be loaded, the service falls back to heuristic analysis so the endpoint still works.
- Image detection can run in `signal-only` mode when image models are unavailable.

## Smoke Test

```bash
python verify_models.py
```

That script exercises all three detectors and exits non-zero if any of them fail.
