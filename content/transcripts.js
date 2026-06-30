/**
 * @typedef {{ startMs: number, text: string }} TranscriptSegment
 * @typedef {{ speaker?: string, text: string, isSpeakerTurn: boolean }} ArticleBlock
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
 * @param {string} name
 * @returns {string}
 */
function cleanSpeakerName(name) {
  return name
    .replace(/\s+/g, " ")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/,.*$/, "")
    .trim();
}

/**
 * @param {string[]} turns
 * @returns {string[]}
 */
function inferSpeakerNames(turns) {
  /** @type {string[]} */
  const names = [];

  const addName = (raw) => {
    const name = cleanSpeakerName(raw);
    if (!name || name.length < 2) return;
    if (names.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      return;
    }
    names.push(name);
  };

  for (const turn of turns.slice(0, 6)) {
    const introMatch = turn.match(
      /\b(?:I'm|I am|my name is)\s+([A-Z][\w'.-]+(?:\s+(?:the\s+)?[A-Z][\w'.-]+){0,2})/i
    );
    if (introMatch) addName(introMatch[1]);

    const guestMatch = turn.match(
      /\bjoining me(?:\s+\w+){0,4}\s+is\s+([A-Z][\w'.-]+)/i
    );
    if (guestMatch) addName(guestMatch[1]);

    const withMatch = turn.match(/\b(?:here with|talking to|speak with)\s+([A-Z][\w'.-]+)/i);
    if (withMatch) addName(withMatch[1]);
  }

  if (names.length >= 2) return names.slice(0, 2);
  if (names.length === 1) return [names[0], "Guest"];
  return ["Speaker 1", "Speaker 2"];
}

/**
 * @param {TranscriptSegment[]} segments
 * @returns {string[]}
 */
function joinSegmentsIntoTurns(segments) {
  /** @type {string[]} */
  const turns = [];
  let current = "";

  for (const segment of segments) {
    let text = segment.text.trim();
    if (!text) continue;

    const startsNewSpeaker = /^>>\s?/.test(text);
    if (startsNewSpeaker) {
      if (current.trim()) {
        turns.push(current.trim());
      }
      current = text.replace(/^>>\s?/, "").trim();
      continue;
    }

    if (!current) {
      current = text;
    } else if (current.endsWith("-")) {
      current += text;
    } else {
      current += ` ${text}`;
    }
  }

  if (current.trim()) {
    turns.push(current.trim());
  }

  return expandInlineSpeakerMarkers(turns);
}

/**
 * @param {string[]} turns
 * @returns {string[]}
 */
function expandInlineSpeakerMarkers(turns) {
  /** @type {string[]} */
  const expanded = [];

  for (const turn of turns) {
    const parts = turn
      .split(/\s*>>\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    expanded.push(...parts);
  }

  return expanded;
}

/**
 * @param {TranscriptSegment[]} segments
 * @returns {ArticleBlock[]}
 */
function formatAsDialogue(segments) {
  const turns = joinSegmentsIntoTurns(segments);
  if (!turns.length) return [];

  const speakers = inferSpeakerNames(turns);

  return turns.map((text, index) => ({
    speaker: speakers[index % speakers.length],
    text: text.replace(/\s*>>\s*/g, " ").trim(),
    isSpeakerTurn: true,
  }));
}

/**
 * @param {TranscriptSegment[]} segments
 * @returns {string[]}
 */
function formatAsArticle(segments) {
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

/**
 * @param {TranscriptSegment[]} segments
 * @returns {ArticleBlock[]}
 */
function formatArticleBody(segments) {
  if (!segments.length) return [];

  const hasSpeakerMarkers = segments.some((segment) => />>/.test(segment.text));
  if (hasSpeakerMarkers) {
    return formatAsDialogue(segments);
  }

  return formatAsArticle(segments).map((text) => ({
    text,
    isSpeakerTurn: false,
  }));
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
