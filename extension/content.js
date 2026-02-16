function extractVisiblePageText(maxChars = 15000) {
  const clone = document.body.cloneNode(true);
  const removeSelectors = ["script", "style", "noscript", "svg", "canvas", "iframe"];
  removeSelectors.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  const text = (clone.innerText || "")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, maxChars);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageText") {
    sendResponse({ text: extractVisiblePageText() });
  }
  return true;
});
