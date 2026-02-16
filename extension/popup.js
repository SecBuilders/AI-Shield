// ===============================
// API CONFIGURATION
// ===============================
const API_BASE_URL = "http://127.0.0.1:8000";

// ===============================
// TAB SWITCHING LOGIC
// ===============================
const tabButtons = document.querySelectorAll(".tabBtn");
const tabContents = document.querySelectorAll(".tabContent");

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabContents.forEach(tab => tab.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

// ===============================
// HELPER FUNCTIONS
// ===============================
function showResult(elementId, htmlContent) {
  const resultBox = document.getElementById(elementId);
  resultBox.innerHTML = htmlContent;
  resultBox.classList.add("visible");
}

function showLoading(elementId) {
  const resultBox = document.getElementById(elementId);
  resultBox.innerHTML = '<div class="loading">Analyzing... Please wait.</div>';
  resultBox.classList.add("visible");
}

function showError(elementId, message) {
  const resultBox = document.getElementById(elementId);
  resultBox.innerHTML = `<div style="color: red;">❌ Error: ${message}</div>`;
  resultBox.classList.add("visible");
}

async function checkBackend() {
  try {
    await fetch(`${API_BASE_URL}/`);
    return true;
  } catch (e) {
    return false;
  }
}

// ===============================
// GRAB PAGE TEXT
// ===============================
document.getElementById("grabTextBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "getPageText" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message failed:", chrome.runtime.lastError);
          return;
        }
        if (response && response.text) {
          document.getElementById("textInput").value = response.text.substring(0, 5000);
        }
      }
    );
  });
});

// ===============================
// TEXT SCAN (REAL AI)
// ===============================
document.getElementById("scanTextBtn").addEventListener("click", async () => {
  const text = document.getElementById("textInput").value.trim();
  if (!text) return showError("textResult", "Please enter text first.");

  showLoading("textResult");

  try {
    const response = await fetch(`${API_BASE_URL}/detect/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    });

    if (!response.ok) throw new Error("Backend connection failed");

    const data = await response.json();

    const isSafe = data.label === "Human-Written";
    const colorClass = isSafe ? "safe" : "danger";
    const width = data.confidence + "%";

    const html = `
            <div class="result-header">
                <span class="${colorClass}">${data.label}</span>
                <span>${data.confidence}%</span>
            </div>
            <div class="confidence-bar">
                <div class="confidence-level" style="width: ${width}; background-color: var(--${isSafe ? 'secondary' : 'danger'});"></div>
            </div>
        `;
    showResult("textResult", html);

  } catch (error) {
    showError("textResult", "Is the Python backend running? " + error.message);
  }
});

// ===============================
// IMAGE SCAN (REAL AI)
// ===============================
document.getElementById("scanImageBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("imageInput");
  if (!fileInput.files.length) return showError("imageResult", "Please select an image.");

  showLoading("imageResult");

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    const response = await fetch(`${API_BASE_URL}/detect/image`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) throw new Error("Backend connection failed");

    const data = await response.json();

    const isSafe = data.label === "Real Image";
    const colorClass = isSafe ? "safe" : "danger";
    const width = data.confidence + "%";

    const html = `
            <div class="result-header">
                <span class="${colorClass}">${data.label}</span>
                <span>${data.confidence}%</span>
            </div>
            <div class="confidence-bar">
                <div class="confidence-level" style="width: ${width}; background-color: var(--${isSafe ? 'secondary' : 'danger'});"></div>
            </div>
            <div style="font-size: 0.8em; margin-top: 5px; color: #666;">
                Model: ViT-Deepfake
            </div>
        `;
    showResult("imageResult", html);

  } catch (error) {
    showError("imageResult", "Is the Python backend running? " + error.message);
  }
});

// ===============================
// PHISHING SCAN (REAL AI)
// ===============================
document.getElementById("scanEmailBtn").addEventListener("click", async () => {
  const text = document.getElementById("emailInput").value.trim();
  if (!text) return showError("emailResult", "Please paste content.");

  showLoading("emailResult");

  try {
    const response = await fetch(`${API_BASE_URL}/detect/phishing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    });

    if (!response.ok) throw new Error("Backend connection failed");

    const data = await response.json();

    const isSafe = data.label === "Legitimate";
    const colorClass = isSafe ? "safe" : "danger";
    const width = data.confidence + "%";

    const html = `
            <div class="result-header">
                <span class="${colorClass}">${data.label}</span>
                <span>${data.confidence}%</span>
            </div>
            <div class="confidence-bar">
                <div class="confidence-level" style="width: ${width}; background-color: var(--${isSafe ? 'secondary' : 'danger'});"></div>
            </div>
        `;
    showResult("emailResult", html);

  } catch (error) {
    showError("emailResult", "Is the Python backend running? " + error.message);
  }
});
