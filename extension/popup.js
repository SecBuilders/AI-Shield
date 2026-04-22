"use strict";

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASES = ["http://127.0.0.1:8080", "http://localhost:8080"];
const MAX_HISTORY = 30;
const HEALTH_MS = 18_000;

let activeBase = API_BASES[0];
let scanLocked = false;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $q = sel => document.querySelector(sel);

const els = {
  statusBadge: $("backendStatus"),
  statusText: $("backendStatus").querySelector(".status-text"),
  modelsLoaded: $("modelsLoaded"),
  textInput: $("textInput"),
  wordCount: $("textWordCount"),
  grabTextBtn: $("grabTextBtn"),
  scanUrlBtn: $("scanUrlBtn"),
  scanTextBtn: $("scanTextBtn"),
  textResult: $("textResult"),
  dropZone: $("dropZone"),
  dropInner: $("dropInner"),
  imageInput: $("imageInput"),
  imagePreview: $("imagePreview"),
  previewImg: $("previewImg"),
  clearImgBtn: $("clearImgBtn"),
  scanImageBtn: $("scanImageBtn"),
  imageResult: $("imageResult"),
  phishInput: $("phishInput"),
  scanPhishBtn: $("scanPhishBtn"),
  phishResult: $("phishResult"),
  historyList: $("historyList"),
  clearHistBtn: $("clearHistoryBtn"),
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function clamp(n) { return Math.max(0, Math.min(100, Number(n) || 0)); }
function countMeaningfulWords(text) {
  const matches = String(text).match(/[A-Za-z][A-Za-z']+/g);
  return matches ? matches.length : 0;
}

function timeSince(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const candidates = [activeBase, ...API_BASES.filter(b => b !== activeBase)];
  let lastErr = null;
  for (const base of candidates) {
    try {
      const res = await fetch(base + path, opts);
      let data = null;
      try { data = await res.json(); } catch { }
      if (res.ok) { activeBase = base; return data || {}; }
      lastErr = new Error(
        (data && (data.detail || data.error || data.message)) || `HTTP ${res.status}`
      );
    } catch (e) {
      lastErr = new Error("Backend not reachable. Is main.py running?");
    }
  }
  throw lastErr;
}

// ── Status / health ───────────────────────────────────────────────────────────

async function checkHealth() {
  const { statusBadge, statusText, modelsLoaded } = els;
  statusBadge.className = "status-badge status-checking";
  statusText.textContent = "Checking…";
  try {
    const h = await apiFetch("/health");
    const det = h.detectors || {};
    const loaded = Object.values(det).filter(Boolean).length;
    const total = Object.keys(det).length;

    if (loaded === total) {
      statusBadge.className = "status-badge status-online";
      statusText.textContent = `Online`;
    } else if (loaded > 0) {
      statusBadge.className = "status-badge status-checking";
      statusText.textContent = `Partial (${loaded}/${total})`;
    } else {
      statusBadge.className = "status-badge status-checking";
      statusText.textContent = `Loading…`;
    }
    modelsLoaded.textContent = `${loaded}/${total} models ready`;
    return true;
  } catch {
    statusBadge.className = "status-badge status-offline";
    statusText.textContent = "Offline";
    modelsLoaded.textContent = "Backend offline";
    return false;
  }
}

// ── Result rendering ──────────────────────────────────────────────────────────

/**
 * @param {'safe'|'danger'|'warning'} verdict
 * @param {string}  label
 * @param {number}  confidence  0-100
 * @param {object}  rawResult
 * @param {object}  [breakdown]
 */
function buildResultCard(verdict, label, confidence, rawResult, breakdown) {
  const icon = verdict === "safe" ? "✓" : verdict === "danger" ? "✕" : "!";
  const conf = clamp(confidence);

  // Raw scores row
  const rawHtml = rawResult
    ? Object.entries(rawResult).filter(([, v]) => v != null).map(([k, v]) =>
      `<span><b>${esc(k)}</b> ${clamp(v).toFixed(1)}%</span>`
    ).join(" · ")
    : "";

  // Breakdown bars
  let bkHtml = "";
  if (breakdown && Object.keys(breakdown).length) {
    bkHtml = `
      <button class="breakdown-toggle" aria-expanded="false">
        <span>Signal breakdown</span>
        <span class="chevron">▼</span>
      </button>
      <div class="breakdown-body">
        ${Object.entries(breakdown).filter(([, v]) => v != null).map(([k, v]) => {
      const pct = clamp(v);
      const key = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      return `<div class="bk-row">
            <span class="bk-label">${esc(key)}</span>
            <div class="bk-bar-wrap"><div class="bk-bar" style="width:${pct}%"></div></div>
            <span class="bk-pct">${pct.toFixed(0)}%</span>
          </div>`;
    }).join("")}
      </div>`;
  }

  const card = document.createElement("div");
  card.className = `result-card verdict-${verdict}`;
  card.innerHTML = `
    <div class="result-main">
      <div class="verdict-badge">
        <div class="verdict-icon">${icon}</div>
        <div class="verdict-label">${esc(label)}</div>
      </div>
      <div class="confidence-pct">${conf.toFixed(1)}%</div>
    </div>
    <div class="conf-bar-wrap">
      <div class="conf-bar-track">
        <div class="conf-bar-fill" data-target="${conf}"></div>
      </div>
    </div>
    ${rawHtml ? `<div class="bk-row" style="padding:0 14px 10px;font-size:11px;color:var(--muted2)">${rawHtml}</div>` : ""}
    ${bkHtml}
  `;

  // Animate bar after insertion
  requestAnimationFrame(() => {
    const fill = card.querySelector(".conf-bar-fill");
    if (fill) { requestAnimationFrame(() => { fill.style.width = fill.dataset.target + "%"; }); }
  });

  // Breakdown toggle
  const toggle = card.querySelector(".breakdown-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const body = card.querySelector(".breakdown-body");
      const open = body.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open);
    });
  }

  return card;
}

function showLoading(zone) {
  zone.innerHTML = `
    <div class="result-loading">
      <div class="skel skel-w80"></div>
      <div class="skel skel-bar"></div>
      <div class="skel skel-w60"></div>
    </div>`;
}

function showError(zone, msg) {
  zone.innerHTML = `
    <div class="error-card">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
      ${esc(msg)}
    </div>`;
}

function showResult(zone, data, type) {
  zone.innerHTML = "";
  let verdict, label, conf;

  if (type === "text") {
    const isAI = data.label === "AI-Generated";
    verdict = isAI ? "danger" : "safe";
    label = isAI ? "AI-Generated Text" : "Human-Written Text";
    conf = clamp(data.confidence);
  } else if (type === "image") {
    const isAI = data.is_ai_generated || data.label?.includes("AI");
    verdict = isAI ? "danger" : "safe";
    label = isAI ? "AI-Generated / Deepfake" : "Likely Real Photo";
    conf = clamp(data.confidence);
  } else { // phishing
    const isBad = data.label?.includes("Phishing") || data.label?.includes("Spam");
    verdict = isBad ? "danger" : "safe";
    label = isBad ? "Phishing / Spam Detected" : "Looks Legitimate";
    conf = clamp(data.confidence);
    if (conf < 60 && isBad) verdict = "warning";
  }

  const card = buildResultCard(verdict, label, conf, data.raw_result, data.breakdown);
  zone.appendChild(card);

  // Save to history
  saveHistory({
    type,
    verdict,
    label,
    confidence: conf,
    ts: Date.now(),
  });
  renderHistory();
}

// ── History ───────────────────────────────────────────────────────────────────

function loadHistory() {
  try { return JSON.parse(localStorage.getItem("aishield_history") || "[]"); }
  catch { return []; }
}

function saveHistory(entry) {
  const hist = loadHistory();
  hist.unshift(entry);
  hist.splice(MAX_HISTORY);
  try { localStorage.setItem("aishield_history", JSON.stringify(hist)); } catch { }
}

function renderHistory() {
  const hist = loadHistory();
  const list = els.historyList;
  if (!hist.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p>No scans yet</p></div>`;
    return;
  }
  const TYPE_ICON = { text: "T", image: "I", phishing: "P" };
  list.innerHTML = hist.map(h => `
    <div class="history-item">
      <div class="hi-icon hi-${h.verdict}">${h.verdict === "safe" ? "✓" : h.verdict === "danger" ? "✕" : "!"}</div>
      <div class="hi-body">
        <div class="hi-label">${esc(h.label)}</div>
        <div class="hi-meta">
          <span class="hi-type">${esc(h.type)}</span>
          <span class="hi-time">${timeSince(h.ts)}</span>
        </div>
      </div>
      <div class="hi-conf ${h.verdict}">${clamp(h.confidence).toFixed(0)}%</div>
    </div>`).join("");
}

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    const id = "tab-" + btn.dataset.tab;
    document.getElementById(id).classList.add("active");
    if (btn.dataset.tab === "history") renderHistory();
  });
});

// ── Word count ────────────────────────────────────────────────────────────────

els.textInput.addEventListener("input", () => {
  const words = countMeaningfulWords(els.textInput.value);
  els.wordCount.textContent = `${words} meaningful word${words !== 1 ? "s" : ""}`;
});

// ── Grab page text ────────────────────────────────────────────────────────────

els.grabTextBtn.addEventListener("click", async () => {
  els.grabTextBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("No active tab");
    const resp = await chrome.tabs.sendMessage(tab.id, { action: "getPageText" });
    if (!resp?.text) throw new Error("No readable text on this page");
    els.textInput.value = resp.text.slice(0, 12_000);
    els.textInput.dispatchEvent(new Event("input"));
  } catch (e) {
    showError(els.textResult, e.message);
  } finally {
    els.grabTextBtn.disabled = false;
  }
});

// ── Scan current URL ──────────────────────────────────────────────────────────

els.scanUrlBtn.addEventListener("click", async () => {
  els.scanUrlBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) throw new Error("Cannot get current URL");
    els.phishInput.value = tab.url;
    // Switch to phishing tab and auto-scan
    document.querySelector('[data-tab="phishing"]').click();
    setTimeout(() => els.scanPhishBtn.click(), 80);
  } catch (e) {
    showError(els.textResult, e.message);
  } finally {
    els.scanUrlBtn.disabled = false;
  }
});

// ── Scan text ────────────────────────────────────────────────────────────────

els.scanTextBtn.addEventListener("click", async () => {
  const text = els.textInput.value.trim();
  if (!text) return showError(els.textResult, "Please enter or extract some text first.");
  const words = countMeaningfulWords(text);
  if (words < 50) return showError(els.textResult, "Please provide at least 50 meaningful words for reliable detection.");
  if (scanLocked) return;

  scanLocked = true;
  els.scanTextBtn.disabled = true;
  showLoading(els.textResult);
  try {
    const data = await apiFetch("/detect/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    showResult(els.textResult, data, "text");
  } catch (e) {
    showError(els.textResult, e.message);
  } finally {
    scanLocked = false;
    els.scanTextBtn.disabled = false;
    checkHealth();
  }
});

// ── Image upload / drag-drop ──────────────────────────────────────────────────

function setImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (file.size > 10 * 1024 * 1024) {
    showError(els.imageResult, "Image is too large (max 10 MB).");
    return;
  }
  const url = URL.createObjectURL(file);
  els.previewImg.src = url;
  els.dropInner.classList.add("hidden");
  els.imagePreview.classList.remove("hidden");
  els.scanImageBtn.disabled = false;
  // store file on input element for later retrieval
  const dt = new DataTransfer();
  dt.items.add(file);
  els.imageInput.files = dt.files;
}

els.imageInput.addEventListener("change", () => {
  if (els.imageInput.files[0]) setImageFile(els.imageInput.files[0]);
});

els.clearImgBtn.addEventListener("click", e => {
  e.stopPropagation();
  els.previewImg.src = "";
  els.imagePreview.classList.add("hidden");
  els.dropInner.classList.remove("hidden");
  els.scanImageBtn.disabled = true;
  els.imageInput.value = "";
  els.imageResult.innerHTML = "";
});

// Drag-drop
const dz = els.dropZone;
["dragenter", "dragover"].forEach(ev =>
  dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag-over"); }));
["dragleave", "drop"].forEach(ev =>
  dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag-over"); }));
dz.addEventListener("drop", e => {
  const file = e.dataTransfer?.files?.[0];
  if (file) setImageFile(file);
});

// ── Scan image ────────────────────────────────────────────────────────────────

els.scanImageBtn.addEventListener("click", async () => {
  const file = els.imageInput.files?.[0];
  if (!file) return showError(els.imageResult, "Please select or drop an image first.");
  if (scanLocked) return;

  scanLocked = true;
  els.scanImageBtn.disabled = true;
  showLoading(els.imageResult);
  try {
    const form = new FormData();
    form.append("file", file);
    const data = await apiFetch("/detect/image", { method: "POST", body: form });
    showResult(els.imageResult, data, "image");
  } catch (e) {
    showError(els.imageResult, e.message);
  } finally {
    scanLocked = false;
    els.scanImageBtn.disabled = false;
    checkHealth();
  }
});

// ── Scan phishing ─────────────────────────────────────────────────────────────

els.scanPhishBtn.addEventListener("click", async () => {
  const text = els.phishInput.value.trim();
  if (!text) return showError(els.phishResult, "Please paste a URL, email, or message.");
  const words = countMeaningfulWords(text);
  const hasUrl = /https?:\/\/|www\./i.test(text);
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
  if (!hasUrl && !hasEmail && words < 5) {
    return showError(els.phishResult, "Please paste a suspicious URL, email, or a longer message.");
  }
  if (scanLocked) return;

  scanLocked = true;
  els.scanPhishBtn.disabled = true;
  showLoading(els.phishResult);
  try {
    const data = await apiFetch("/detect/phishing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    showResult(els.phishResult, data, "phishing");
  } catch (e) {
    showError(els.phishResult, e.message);
  } finally {
    scanLocked = false;
    els.scanPhishBtn.disabled = false;
    checkHealth();
  }
});

// ── History actions ───────────────────────────────────────────────────────────

els.clearHistBtn.addEventListener("click", () => {
  try { localStorage.removeItem("aishield_history"); } catch { }
  renderHistory();
});

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
// Ctrl+Enter in any textarea → trigger its scan button
[
  [els.textInput, els.scanTextBtn],
  [els.phishInput, els.scanPhishBtn],
].forEach(([area, btn]) => {
  area.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      btn.click();
    }
  });
});

// ── Popout UI ─────────────────────────────────────────────────────────────────
const openFullTabBtn = $("openFullTabBtn");
if (openFullTabBtn) {
  openFullTabBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

checkHealth();
setInterval(checkHealth, HEALTH_MS);
renderHistory();
