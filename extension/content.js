"use strict";

/**
 * Content script for AI Shield.
 * Extracts meaningful visible page text, stripping navigation, ads,
 * scripts, and boilerplate so the detector sees only real content.
 */

const STRIP_TAGS   = ["script","style","noscript","svg","canvas","iframe","nav","footer","aside"];
const STRIP_ROLES  = ["navigation","banner","contentinfo","complementary"];
const NOISE_LABELS = ["nav","header","footer","sidebar","menu","cookie","consent","subscribe","newsletter"];

function extractPageText(maxChars = 12_000) {
  const clone = document.body.cloneNode(true);

  // Remove non-content elements
  STRIP_TAGS.forEach(tag => clone.querySelectorAll(tag).forEach(el => el.remove()));

  // Remove by ARIA role
  STRIP_ROLES.forEach(role =>
    clone.querySelectorAll(`[role="${role}"]`).forEach(el => el.remove()));

  // Remove noise by class/id name heuristics
  clone.querySelectorAll("[class],[id]").forEach(el => {
    const name = ((el.className || "") + " " + (el.id || "")).toLowerCase();
    if (NOISE_LABELS.some(kw => name.includes(kw))) el.remove();
  });

  // Prefer semantic article / main content if present
  const article = clone.querySelector("article,main,[role='main'],[role='article']");
  const root    = article || clone;

  const text = (root.innerText || root.textContent || "")
    .replace(/[ \t]+/g, " ")          // Collapse spaces
    .replace(/\n{3,}/g, "\n\n")       // Max 2 blank lines
    .trim();

  return text.slice(0, maxChars);
}

chrome.runtime.onMessage.addListener((req, _sender, reply) => {
  if (req.action === "getPageText") {
    reply({ text: extractPageText(), url: location.href, title: document.title });
  }
  return true;   // keep channel open for async reply
});