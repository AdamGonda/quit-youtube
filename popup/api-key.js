const input = document.getElementById("api-key");
const saveButton = document.getElementById("save");

chrome.storage.local.get("googleApiKey", ({ googleApiKey }) => {
  if (typeof googleApiKey === "string") {
    input.value = googleApiKey;
  }
});

saveButton.addEventListener("click", () => {
  const apiKey = input.value.trim();
  if (apiKey) {
    chrome.storage.local.set({ googleApiKey: apiKey }, () => {
      window.close();
    });
    return;
  }

  chrome.storage.local.remove("googleApiKey", () => {
    window.close();
  });
});
