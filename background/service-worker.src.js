import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const STORAGE_KEY = "googleApiKey";
const TLDR_MODEL = "gemini-3-flash-preview";
const MAX_TRANSCRIPT_CHARS = 80000;
const CONTEXT_MENU_ID = "set-google-api-key";

/**
 * @returns {Promise<string | null>}
 */
async function getApiKey() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const key = result[STORAGE_KEY];
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

/**
 * @param {string | null} apiKey
 */
async function setApiKey(apiKey) {
  if (apiKey) {
    await chrome.storage.local.set({ [STORAGE_KEY]: apiKey });
    return;
  }
  await chrome.storage.local.remove(STORAGE_KEY);
}

function ensureContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Set Google API key for TLDR",
      contexts: ["action"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const tab = info.tab;
  if (tab?.id && tab.url?.startsWith("https://www.youtube.com/")) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "tldr-prompt-api-key" });
      return;
    } catch {
      // Content script not ready; fall through to options page.
    }
  }

  chrome.windows.create({
    url: chrome.runtime.getURL("popup/api-key.html"),
    type: "popup",
    width: 420,
    height: 260,
  });
});

/**
 * @param {string} transcript
 */
function trimTranscript(transcript) {
  if (transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript;
  return `${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}…`;
}

/**
 * @param {string} transcript
 * @param {string} apiKey
 */
async function summarizeTranscript(transcript, apiKey) {
  const google = createGoogleGenerativeAI({ apiKey });
  const { text } = await generateText({
    model: google(TLDR_MODEL),
    prompt: `Summarize this YouTube transcript in 3-5 concise bullet points:\n\n${trimTranscript(transcript)}`,
  });
  return text.trim();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "tldr-has-api-key") {
    void getApiKey().then((key) => {
      sendResponse({ hasKey: Boolean(key) });
    });
    return true;
  }

  if (message?.type === "tldr-save-api-key") {
    const apiKey =
      typeof message.apiKey === "string" ? message.apiKey.trim() : "";
    void setApiKey(apiKey || null).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "tldr-summarize") {
    const transcript =
      typeof message.transcript === "string" ? message.transcript.trim() : "";

    void (async () => {
      if (!transcript) {
        sendResponse({ ok: false, error: "emptyTranscript" });
        return;
      }

      const apiKey = await getApiKey();
      if (!apiKey) {
        sendResponse({ ok: false, error: "missingApiKey" });
        return;
      }

      try {
        const summary = await summarizeTranscript(transcript, apiKey);
        sendResponse({ ok: true, summary });
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : "Summarization failed";
        sendResponse({ ok: false, error: messageText });
      }
    })();

    return true;
  }

  return false;
});
