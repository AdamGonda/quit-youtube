/**
 * @typedef {{ startMs: number, text: string }} TranscriptSegment
 */

/** @type {Map<string, TranscriptSegment[] | null>} */
const transcriptCache = new Map();

/** @type {Map<string, Promise<TranscriptSegment[] | null>>} */
const inFlightRequests = new Map();

/** @type {Map<string, (result: TranscriptSegment[] | null) => void>} */
const pendingCallbacks = new Map();

let requestCounter = 0;
let listenerInitialized = false;

const FETCH_TIMEOUT_MS = 20000;

/**
 * @param {string} requestId
 * @returns {Promise<TranscriptSegment[] | null>}
 */
function waitForTranscriptResponse(requestId) {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      pendingCallbacks.delete(requestId);
      resolve(null);
    }, FETCH_TIMEOUT_MS);

    pendingCallbacks.set(requestId, (result) => {
      window.clearTimeout(timeoutId);
      pendingCallbacks.delete(requestId);
      resolve(result);
    });
  });
}

function initTranscriptListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "attention-shield-transcript-result") return;

    const requestId = event.data.requestId;
    if (typeof requestId !== "string") return;

    const callback = pendingCallbacks.get(requestId);
    if (!callback) return;

    if (event.data.ok && Array.isArray(event.data.segments)) {
      callback(event.data.segments);
      return;
    }

    callback(null);
  });
}

/**
 * @param {string} videoId
 * @returns {Promise<TranscriptSegment[] | null>}
 */
async function fetchTranscriptFromPage(videoId) {
  initTranscriptListener();

  const requestId = `as-transcript-${++requestCounter}-${Date.now()}`;

  window.postMessage(
    {
      type: "attention-shield-fetch-transcript",
      requestId,
      videoId,
    },
    "*"
  );

  return waitForTranscriptResponse(requestId);
}

/**
 * @param {string} videoId
 * @returns {Promise<TranscriptSegment[] | null>}
 */
async function fetchTranscript(videoId) {
  if (!videoId) return null;

  if (transcriptCache.has(videoId)) {
    return transcriptCache.get(videoId) ?? null;
  }

  let pending = inFlightRequests.get(videoId);
  if (!pending) {
    pending = fetchTranscriptFromPage(videoId).then((segments) => {
      transcriptCache.set(videoId, segments);
      inFlightRequests.delete(videoId);
      return segments;
    });
    inFlightRequests.set(videoId, pending);
  }

  return pending;
}

/**
 * @param {TranscriptSegment[]} segments
 * @returns {string[]}
 */
function formatArticleBody(segments) {
  if (!segments.length) return [];

  /** @type {string[]} */
  const paragraphs = [];
  let current = "";
  let lastEndMs = segments[0]?.startMs ?? 0;

  for (const segment of segments) {
    const gapMs = segment.startMs - lastEndMs;
    const text = segment.text.trim();
    if (!text) continue;

    if (current && gapMs > 3000) {
      paragraphs.push(current.trim());
      current = text;
    } else if (!current) {
      current = text;
    } else if (/[.!?]["')\]]*$/.test(current) && /^[A-Z"']/.test(text)) {
      paragraphs.push(current.trim());
      current = text;
    } else {
      current += current.endsWith("-") ? text : ` ${text}`;
    }

    lastEndMs = segment.startMs;
  }

  if (current.trim()) {
    paragraphs.push(current.trim());
  }

  return paragraphs;
}

function clearTranscriptCache() {
  transcriptCache.clear();
  inFlightRequests.clear();
}

window.AttentionShieldTranscripts = {
  fetchTranscript,
  formatArticleBody,
  clearTranscriptCache,
};
