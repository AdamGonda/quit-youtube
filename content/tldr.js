/**
 * @typedef {{ startMs: number, text: string }} TranscriptSegment
 */

/**
 * @param {TranscriptSegment[]} segments
 * @returns {string}
 */
function segmentsToText(segments) {
  return segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * @returns {Promise<boolean>}
 */
function hasApiKey() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "tldr-has-api-key" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(response?.hasKey));
    });
  });
}

/**
 * @param {string} transcript
 * @returns {Promise<string>}
 */
function summarize(transcript) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "tldr-summarize", transcript },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response?.ok && typeof response.summary === "string") {
          resolve(response.summary);
          return;
        }

        const error = new Error(
          response?.error === "missingApiKey"
            ? "Missing API key"
            : response?.error || "Summarization failed"
        );
        if (response?.error === "missingApiKey") {
          error.code = "missingApiKey";
        }
        reject(error);
      }
    );
  });
}

/**
 * @param {string | null | undefined} apiKey
 */
function saveApiKeyFromPrompt(apiKey) {
  const trimmed = typeof apiKey === "string" ? apiKey.trim() : "";
  chrome.runtime.sendMessage({
    type: "tldr-save-api-key",
    apiKey: trimmed,
  });
}

function promptForApiKey() {
  const apiKey = window.prompt(
    "Paste your Google AI API key for TLDR (leave empty to remove):",
    ""
  );
  if (apiKey === null) return;
  saveApiKeyFromPrompt(apiKey);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "tldr-prompt-api-key") {
    promptForApiKey();
  }
});

window.AttentionShieldTldr = {
  hasApiKey,
  summarize,
  segmentsToText,
};
