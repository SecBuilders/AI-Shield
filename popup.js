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
    document.getElementById(button.dataset.tab)
      .classList.add("active");
  });
});


// ===============================
// GRAB PAGE TEXT
// ===============================
document.getElementById("grabTextBtn").addEventListener("click", () => {

  console.log("Grab button clicked");

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
          document.getElementById("textInput").value =
            response.text.substring(0, 3000);
        }
      }
    );
  });
});


// ===============================
// TEXT SCAN (MOCK AI)
// ===============================
document.getElementById("scanTextBtn")
  .addEventListener("click", () => {

    const text =
      document.getElementById("textInput").value.trim();

    const resultBox =
      document.getElementById("textResult");

    if (!text) {
      resultBox.innerText = "⚠️ Please enter text first.";
      return;
    }

    resultBox.innerText = "Scanning...";

    setTimeout(() => {

      const aiScore = Math.floor(Math.random() * 100);

      let risk = "";
      let icon = "";

      if (aiScore < 40) {
        risk = "LOW";
        icon = "🟢";
      } else if (aiScore < 70) {
        risk = "MEDIUM";
        icon = "🟡";
      } else {
        risk = "HIGH";
        icon = "🔴";
      }

      resultBox.innerText =
        `${icon} AI Probability: ${aiScore}%\nRisk Level: ${risk}`;

    }, 1000);

});


// ===============================
// IMAGE SCAN (MOCK AI)
// ===============================
document.getElementById("scanImageBtn")
  .addEventListener("click", () => {

    const fileInput = document.getElementById("imageInput");
    const resultBox = document.getElementById("imageResult");

    if (!fileInput.files.length) {
      resultBox.innerText = "⚠️ Please select an image.";
      return;
    }

    const file = fileInput.files[0];

    resultBox.innerText = "Scanning image...";

    setTimeout(() => {

      const aiScore = Math.floor(Math.random() * 100);

      let risk = "";
      let icon = "";

      if (aiScore < 40) {
        risk = "LOW";
        icon = "🟢";
      } else if (aiScore < 70) {
        risk = "MEDIUM";
        icon = "🟡";
      } else {
        risk = "HIGH";
        icon = "🔴";
      }

      resultBox.innerText =
        `${icon} Image: ${file.name}\nAI Probability: ${aiScore}%\nRisk Level: ${risk}`;

    }, 1000);

});


// ===============================
// EMAIL SCAN (MOCK PHISHING)
// ===============================
document.getElementById("scanEmailBtn")
  .addEventListener("click", () => {

    const emailText =
      document.getElementById("emailInput").value.trim();

    const resultBox =
      document.getElementById("emailResult");

    if (!emailText) {
      resultBox.innerText = "⚠️ Please paste email content.";
      return;
    }

    resultBox.innerText = "Scanning email...";

    setTimeout(() => {

      const phishingScore =
        Math.floor(Math.random() * 100);

      let risk = "";
      let icon = "";

      if (phishingScore < 40) {
        risk = "LOW";
        icon = "🟢";
      } else if (phishingScore < 70) {
        risk = "MEDIUM";
        icon = "🟡";
      } else {
        risk = "HIGH";
        icon = "🔴";
      }

      resultBox.innerText =
        `${icon} Phishing Probability: ${phishingScore}%\nRisk Level: ${risk}`;

    }, 1000);

});
