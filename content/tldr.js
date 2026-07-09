/**
 * @param {HTMLElement} parent
 * @param {string} text
 */
function appendInlineMarkdown(parent, text) {
  if (!text) return;

  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match[1] !== undefined) {
      const strong = document.createElement("strong");
      strong.textContent = match[1];
      parent.appendChild(strong);
    } else if (match[2] !== undefined) {
      const em = document.createElement("em");
      em.textContent = match[2];
      parent.appendChild(em);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

/**
 * @param {string} line
 * @returns {string | null}
 */
function extractListItem(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
  return match ? match[1] : null;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isIntroLine(line) {
  return /^(here (is|are)|summary|tldr|below)/i.test(line.trim());
}

/**
 * @param {HTMLElement} parent
 * @param {string} markdown
 */
function renderMarkdown(parent, markdown) {
  parent.replaceChildren();

  const lines = markdown.split("\n");
  /** @type {HTMLUListElement | null} */
  let currentList = null;

  const flushList = () => {
    currentList = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || isIntroLine(trimmed)) {
      flushList();
      continue;
    }

    const listContent = extractListItem(trimmed);
    if (listContent !== null) {
      if (!currentList) {
        currentList = document.createElement("ul");
        parent.appendChild(currentList);
      }

      const listItem = document.createElement("li");
      appendInlineMarkdown(listItem, listContent);
      currentList.appendChild(listItem);
      continue;
    }

    flushList();
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, trimmed);
    parent.appendChild(paragraph);
  }
}

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
  renderMarkdown,
};
