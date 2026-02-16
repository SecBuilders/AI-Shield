const API_BASE_URL = "http://127.0.0.1:8000";
const BACKEND_CHECK_INTERVAL_MS = 20000;

const tabButtons = document.querySelectorAll(".tabBtn");
const tabContents = document.querySelectorAll(".tabContent");

const backendStatusEl = document.getElementById("backendStatus");
const textInputEl = document.getElementById("textInput");
const textWordCountEl = document.getElementById("textWordCount");

const scanTextBtn = document.getElementById("scanTextBtn");
const scanImageBtn = document.getElementById("scanImageBtn");
const scanEmailBtn = document.getElementById("scanEmailBtn");
const grabTextBtn = document.getElementById("grabTextBtn");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(100, n));
}

function setBackendStatus(mode, text) {
  backendStatusEl.textContent = text;
  backendStatusEl.classList.remove("status-online", "status-offline", "status-pending");
  if (mode === "online") backendStatusEl.classList.add("status-online");
  else if (mode === "offline") backendStatusEl.classList.add("status-offline");
  else backendStatusEl.classList.add("status-pending");
}

async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    throw new Error("Could not connect to backend. Start backend/main.py first.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      (payload && (payload.detail || payload.error || payload.message)) ||
      `Request failed (${response.status})`;
    throw new Error(String(detail));
  }

  return payload || {};
}

function showResult(elementId, htmlContent) {
  const resultBox = document.getElementById(elementId);
  resultBox.innerHTML = htmlContent;
  resultBox.classList.add("visible");
}

function showLoading(elementId) {
  showResult(elementId, '<div class="loading">Analyzing...</div>');
}

function showError(elementId, message) {
  showResult(elementId, `<div class="error">Error: ${escapeHtml(message)}</div>`);
}

function renderResult(label, confidence, isSafe, rawScores) {
  const safeClass = isSafe ? "safe" : "danger";
  const barColor = isSafe ? "var(--safe)" : "var(--danger)";
  const width = clampConfidence(confidence);
  const details = rawScores
    ? Object.entries(rawScores)
        .map(([k, v]) => `${escapeHtml(k)}: ${clampConfidence(v).toFixed(2)}%`)
        .join(" | ")
    : "";

  return `
    <div class="result-header">
      <span class="result-label ${safeClass}">${escapeHtml(label)}</span>
      <span class="result-score">${width.toFixed(2)}%</span>
    </div>
    <div class="confidence-bar">
      <div class="confidence-level" style="width:${width}%; background:${barColor};"></div>
    </div>
    ${details ? `<div class="details">${details}</div>` : ""}
  `;
}

function setButtonsDisabled(disabled) {
  scanTextBtn.disabled = disabled;
  scanImageBtn.disabled = disabled;
  scanEmailBtn.disabled = disabled;
  grabTextBtn.disabled = disabled;
}

function updateWordCount() {
  const text = textInputEl.value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  textWordCountEl.textContent = `${count} words`;
}

function getPageText() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) {
        reject(new Error("No active tab found."));
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: "getPageText" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error("Could not read page text on this tab."));
          return;
        }
        if (!response || !response.text) {
          reject(new Error("No readable text found on this page."));
          return;
        }
        resolve(response.text);
      });
    });
  });
}

async function checkBackendHealth() {
  setBackendStatus("pending", "Checking backend...");
  try {
    const health = await apiFetch("/health");
    const loaded = Object.values((health && health.detectors) || {}).filter(Boolean).length;
    setBackendStatus("online", `Backend online (${loaded}/3 loaded)`);
    return true;
  } catch (error) {
    setBackendStatus("offline", "Backend offline");
    return false;
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

grabTextBtn.addEventListener("click", async () => {
  try {
    const text = await getPageText();
    textInputEl.value = text.slice(0, 10000);
    updateWordCount();
  } catch (error) {
    showError("textResult", error.message);
  }
});

textInputEl.addEventListener("input", updateWordCount);

scanTextBtn.addEventListener("click", async () => {
  const text = textInputEl.value.trim();
  if (!text) {
    showError("textResult", "Please enter text first.");
    return;
  }

  showLoading("textResult");
  setButtonsDisabled(true);
  try {
    const data = await apiFetch("/detect/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const isSafe = data.label === "Human-Written";
    showResult("textResult", renderResult(data.label, data.confidence, isSafe, data.raw_result));
  } catch (error) {
    showError("textResult", error.message);
  } finally {
    setButtonsDisabled(false);
    checkBackendHealth();
  }
});

scanImageBtn.addEventListener("click", async () => {
  const fileInput = document.getElementById("imageInput");
  if (!fileInput.files.length) {
    showError("imageResult", "Please select an image.");
    return;
  }

  const file = fileInput.files[0];
  if (file.size > 10 * 1024 * 1024) {
    showError("imageResult", "Image is too large. Use a file below 10 MB.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  showLoading("imageResult");
  setButtonsDisabled(true);
  try {
    const data = await apiFetch("/detect/image", {
      method: "POST",
      body: formData,
    });

    const isSafe = data.label === "Real Image";
    showResult("imageResult", renderResult(data.label, data.confidence, isSafe, data.raw_result));
  } catch (error) {
    showError("imageResult", error.message);
  } finally {
    setButtonsDisabled(false);
    checkBackendHealth();
  }
});

scanEmailBtn.addEventListener("click", async () => {
  const text = document.getElementById("emailInput").value.trim();
  if (!text) {
    showError("emailResult", "Please paste URL or email content first.");
    return;
  }

  showLoading("emailResult");
  setButtonsDisabled(true);
  try {
    const data = await apiFetch("/detect/phishing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const isSafe = data.label === "Legitimate";
    showResult("emailResult", renderResult(data.label, data.confidence, isSafe, data.raw_result));
  } catch (error) {
    showError("emailResult", error.message);
  } finally {
    setButtonsDisabled(false);
    checkBackendHealth();
  }
});

updateWordCount();
checkBackendHealth();
setInterval(checkBackendHealth, BACKEND_CHECK_INTERVAL_MS);
