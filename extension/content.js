console.log("CONTENT SCRIPT LOADED");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "getPageText") {
    sendResponse({
      text: document.body.innerText
    });
  }

  return true; 
});
