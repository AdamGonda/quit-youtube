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

const NAME_TOKEN = "[A-Z][a-z]+(?:['.-][A-Za-z]+)?";
const NAME_BOUNDARY =
  "(?=\\s+(?:and|but|who|with|on|from|for|here|today|this|to)\\b|[,.]|\\s*$)";

/**
 * @param {string} name
 * @returns {string}
 */
function cleanSpeakerName(name) {
  return name
    .replace(/\s+/g, " ")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/,.*$/, "")
    .replace(/\s+and$/i, "")
    .trim();
}

/**
 * @param {string} turn
 * @returns {string | null}
 */
function extractHostName(turn) {
  const introMatch = turn.match(
    new RegExp(
      `\\b(?:I'm|I am|my name is)\\s+(?!not\\b|sure\\b)(?:the\\s+)?(${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?)${NAME_BOUNDARY}`,
      "i"
    )
  );
  return introMatch ? cleanSpeakerName(introMatch[1]) : null;
}

/**
 * @param {string} turn
 * @returns {string | null}
 */
function extractGuestName(turn) {
  const guestMatch = turn.match(
    new RegExp(
      `\\bjoining me\\b[^.]{0,120}?\\bis\\s+(${NAME_TOKEN}(?:\\s*,\\s*(?:the\\s+)?${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?)?)`,
      "i"
    )
  );
  if (guestMatch) return cleanSpeakerName(guestMatch[1]);

  const withMatch = turn.match(
    new RegExp(
      `\\b(?:here with|talking to|speak with)\\s+(${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?)${NAME_BOUNDARY}`,
      "i"
    )
  );
  return withMatch ? cleanSpeakerName(withMatch[1]) : null;
}

/**
 * @param {string[]} turns
 * @returns {string[]}
 */
function inferSpeakerNames(turns) {
  /** @type {string | null} */
  let host = null;
  /** @type {string | null} */
  let guest = null;

  for (const turn of turns.slice(0, 8)) {
    if (!host) {
      host = extractHostName(turn);
    }
    if (!guest) {
      guest = extractGuestName(turn);
    }
    if (host && guest) break;
  }

  if (host && guest) return [host, guest];
  if (host) return [host, "Guest"];
  if (guest) return ["Host", guest];
  return ["Speaker 1", "Speaker 2"];
}

/**
 * @param {string[]} turns
 * @returns {number}
 */
function findIntroTurnIndex(turns) {
  for (let index = 0; index < Math.min(turns.length, 8); index++) {
    const turn = turns[index];
    if (extractHostName(turn) && /\bjoining me\b/i.test(turn)) {
      return index;
    }
  }

  for (let index = 0; index < Math.min(turns.length, 8); index++) {
    if (extractHostName(turns[index])) {
      return index;
    }
  }

  return -1;
}

/**
 * @param {number} turnIndex
 * @param {number} introTurnIndex
 * @param {string[]} speakers
 * @returns {string}
 */
function speakerForTurnIndex(turnIndex, introTurnIndex, speakers) {
  if (speakers.length < 2) {
    return speakers[0] ?? "Speaker";
  }

  const hostParity = introTurnIndex >= 0 ? introTurnIndex % 2 : 0;
  const speakerIndex = turnIndex % 2 === hostParity ? 0 : 1;
  return speakers[speakerIndex];
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
  const introTurnIndex = findIntroTurnIndex(turns);

  return turns.map((text, index) => ({
    speaker: speakerForTurnIndex(index, introTurnIndex, speakers),
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
