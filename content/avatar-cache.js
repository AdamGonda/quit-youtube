/** @type {Map<string, string>} */
const avatarByVideoId = new Map();
/** @type {Map<string, string[]>} */
const avatarsByVideoId = new Map();
/** @type {Map<string, string>} */
const channelByVideoId = new Map();
/** @type {Map<string, string>} */
const durationByVideoId = new Map();

/**
 * @param {string} text
 * @returns {boolean}
 */
function isVideoDurationLabel(text) {
  const trimmed = text.trim();
  return (
    /^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed) ||
    /^(LIVE|UPCOMING|PREMIERE)$/i.test(trimmed)
  );
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function readSimpleText(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (!value || typeof value !== "object") return null;
  const record = /** @type {Record<string, unknown>} */ (value);
  if (typeof record.simpleText === "string" && record.simpleText.trim()) {
    return record.simpleText.trim();
  }
  if (typeof record.content === "string" && record.content.trim()) {
    return record.content.trim();
  }
  const runs = record.runs;
  if (Array.isArray(runs) && runs.length > 0) {
    const first = runs[0];
    if (first && typeof first === "object") {
      const text = /** @type {{ text?: string }} */ (first).text;
      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }
    }
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function formatDurationFromSeconds(raw) {
  const total = Math.floor(Number(raw));
  if (!Number.isFinite(total) || total <= 0) return null;

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * @param {Record<string, unknown>} viewModel
 * @returns {string | null}
 */
function extractDurationFromLockupOverlays(viewModel) {
  const contentImage = /** @type {Record<string, unknown>} */ (
    viewModel.contentImage
  );
  const thumbnailViewModel = /** @type {Record<string, unknown>} */ (
    contentImage?.thumbnailViewModel
  );
  const overlays = /** @type {unknown[] | undefined} */ (
    thumbnailViewModel?.overlays
  );

  if (!Array.isArray(overlays)) return null;

  for (const overlay of overlays) {
    if (!overlay || typeof overlay !== "object") continue;
    const overlayRecord = /** @type {Record<string, unknown>} */ (overlay);

    const badgeGroups = [
      /** @type {unknown[] | undefined} */ (
        /** @type {Record<string, unknown>} */ (
          overlayRecord.thumbnailOverlayBadgeViewModel
        )?.thumbnailBadges
      ),
      /** @type {unknown[] | undefined} */ (
        /** @type {Record<string, unknown>} */ (
          overlayRecord.thumbnailBottomOverlayViewModel
        )?.badges
      ),
    ];

    for (const group of badgeGroups) {
      if (!Array.isArray(group)) continue;

      for (const badge of group) {
        if (!badge || typeof badge !== "object") continue;
        const badgeRecord = /** @type {Record<string, unknown>} */ (badge);
        const badgeVm = /** @type {Record<string, unknown>} */ (
          badgeRecord.thumbnailBadgeViewModel
        );
        const text =
          readSimpleText(badgeVm?.text) || readSimpleText(badgeVm?.label);
        if (text && isVideoDurationLabel(text)) {
          return text;
        }
      }
    }

    const timeOverlay = /** @type {Record<string, unknown>} */ (
      overlayRecord.thumbnailOverlayTimeStatusViewModel
    );
    const timeText = readSimpleText(timeOverlay?.text);
    if (timeText && isVideoDurationLabel(timeText)) {
      return timeText;
    }
  }

  return null;
}

/**
 * @param {string} videoId
 * @param {string | null | undefined} duration
 */
function rememberDuration(videoId, duration) {
  if (!videoId || !duration) return;
  const trimmed = duration.trim();
  if (!isVideoDurationLabel(trimmed)) return;
  if (durationByVideoId.get(videoId) === trimmed) return;
  durationByVideoId.set(videoId, trimmed);

  for (const callback of updateCallbacks) {
    callback();
  }
}

/**
 * @param {unknown} node
 * @param {number} depth
 * @returns {string | null}
 */
function findDurationTextInNode(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 12) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findDurationTextInNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const obj = /** @type {Record<string, unknown>} */ (node);

  const lengthText = readSimpleText(obj.lengthText);
  if (lengthText && isVideoDurationLabel(lengthText)) {
    return lengthText;
  }

  const overlay = /** @type {Record<string, unknown>} */ (
    obj.thumbnailOverlayTimeStatusViewModel
  );
  const overlayText = readSimpleText(overlay?.text);
  if (overlayText && isVideoDurationLabel(overlayText)) {
    return overlayText;
  }

  const badgeVm = /** @type {Record<string, unknown>} */ (
    obj.thumbnailBadgeViewModel
  );
  const badgeText =
    readSimpleText(badgeVm?.text) || readSimpleText(badgeVm?.label);
  if (badgeText && isVideoDurationLabel(badgeText)) {
    return badgeText;
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findDurationTextInNode(value, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

const AVATAR_URL_HINT =
  /(?:ggpht\.com|googleusercontent\.com|ytimg\.com\/ytc\/)/i;
const VIDEO_THUMB_HINT = /\/vi(?:_webp)?\/|hqdefault|mqdefault|sddefault|maxresdefault/i;

let bridgeInjected = false;
/** @type {Set<() => void>} */
const updateCallbacks = new Set();

/**
 * @param {string} url
 * @returns {boolean}
 */
function looksLikeAvatarUrl(url) {
  if (!url || url.startsWith("data:")) return false;
  if (VIDEO_THUMB_HINT.test(url)) return false;
  return AVATAR_URL_HINT.test(url);
}

/**
 * @param {Array<{ url?: string }> | undefined} thumbnails
 * @returns {string | null}
 */
function pickBestUrl(thumbnails) {
  if (!thumbnails?.length) return null;

  for (let i = thumbnails.length - 1; i >= 0; i -= 1) {
    const url = thumbnails[i]?.url;
    if (url && looksLikeAvatarUrl(url)) {
      return url;
    }
  }

  return null;
}

/**
 * @param {string} videoId
 * @param {string[]} urls
 */
function rememberAvatars(videoId, urls) {
  if (!videoId || !urls.length) return;

  const validUrls = urls.filter((url) => looksLikeAvatarUrl(url));
  if (!validUrls.length) return;

  const previous = avatarsByVideoId.get(videoId)?.join("|");
  const next = validUrls.join("|");
  if (previous === next) return;

  avatarsByVideoId.set(videoId, validUrls);
  avatarByVideoId.set(videoId, validUrls[0]);

  for (const callback of updateCallbacks) {
    callback();
  }
}

/**
 * @param {string} videoId
 * @param {string | null | undefined} channel
 */
function rememberChannel(videoId, channel) {
  if (!videoId || !channel) return;
  const trimmed = channel.trim();
  if (!trimmed || channelByVideoId.get(videoId) === trimmed) return;
  channelByVideoId.set(videoId, trimmed);
}

/**
 * @param {string} videoId
 * @param {string | null | undefined} url
 */
function rememberAvatar(videoId, url) {
  if (!videoId || !url || !looksLikeAvatarUrl(url)) return;
  rememberAvatars(videoId, [url]);
}

/**
 * @param {Record<string, unknown>} renderer
 */
function indexVideoRenderer(renderer) {
  const videoId =
    typeof renderer.videoId === "string" ? renderer.videoId : null;
  if (!videoId) return;

  const channelThumb = /** @type {Record<string, unknown>} */ (
    renderer.channelThumbnailSupportedRenderers
  );
  const withLink = /** @type {Record<string, unknown>} */ (
    channelThumb?.channelThumbnailWithLinkRenderer
  );
  const thumbObj = /** @type {Record<string, unknown>} */ (withLink?.thumbnail);
  const avatarObj = /** @type {Record<string, unknown>} */ (renderer.avatar);
  const channelThumbDirect = /** @type {Record<string, unknown>} */ (
    renderer.channelThumbnail
  );

  const candidates = [
    pickBestUrl(/** @type {Array<{ url?: string }>} */ (thumbObj?.thumbnails)),
    pickBestUrl(/** @type {Array<{ url?: string }>} */ (avatarObj?.thumbnails)),
    pickBestUrl(
      /** @type {Array<{ url?: string }>} */ (channelThumbDirect?.thumbnails)
    ),
  ];

  const lengthText = readSimpleText(renderer.lengthText);
  if (lengthText) {
    rememberDuration(videoId, lengthText);
  }

  const fromSeconds = formatDurationFromSeconds(renderer.lengthSeconds);
  if (fromSeconds) {
    rememberDuration(videoId, fromSeconds);
  }

  for (const url of candidates) {
    if (url) {
      rememberAvatar(videoId, url);
      return;
    }
  }
}

/**
 * @param {Record<string, unknown>} viewModel
 */
function indexLockupViewModel(viewModel) {
  if (viewModel.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return;

  const videoId =
    typeof viewModel.contentId === "string" ? viewModel.contentId : null;
  if (!videoId) return;

  const metadata = /** @type {Record<string, unknown>} */ (viewModel.metadata);
  const lockupMeta = /** @type {Record<string, unknown>} */ (
    metadata?.lockupMetadataViewModel
  );
  const image = /** @type {Record<string, unknown>} */ (lockupMeta?.image);

  const decorated = /** @type {Record<string, unknown>} */ (
    image?.decoratedAvatarViewModel
  );
  const avatar = /** @type {Record<string, unknown>} */ (decorated?.avatar);
  const avatarVm = /** @type {Record<string, unknown>} */ (
    avatar?.avatarViewModel
  );
  const avatarImage = /** @type {Record<string, unknown>} */ (avatarVm?.image);
  const singleUrl = pickBestUrl(
    /** @type {Array<{ url?: string }>} */ (avatarImage?.sources)
  );
  if (singleUrl) {
    rememberAvatars(videoId, [singleUrl]);
  }

  const avatarStack = /** @type {Record<string, unknown>} */ (
    image?.avatarStackViewModel
  );
  const stackAvatars = /** @type {Array<Record<string, unknown>> | undefined} */ (
    avatarStack?.avatars
  );
  if (stackAvatars?.length) {
    const stackUrls = stackAvatars
      .map((entry) =>
        pickBestUrl(
          /** @type {Array<{ url?: string }>} */ (
            /** @type {Record<string, unknown>} */ (entry.avatarViewModel)?.image
          )?.sources
        )
      )
      .filter((url) => Boolean(url));

    if (stackUrls.length) {
      rememberAvatars(videoId, /** @type {string[]} */ (stackUrls));
    }
  }

  const contentMetadata = /** @type {Record<string, unknown>} */ (
    lockupMeta?.metadata
  )?.contentMetadataViewModel;
  const metadataRows = /** @type {Array<Record<string, unknown>> | undefined} */ (
    contentMetadata?.metadataRows
  );
  const firstPart = /** @type {Record<string, unknown> | undefined} */ (
    /** @type {Array<Record<string, unknown>> | undefined} */ (
      metadataRows?.[0]?.metadataParts
    )?.[0]
  );
  const channelText = /** @type {Record<string, unknown> | undefined} */ (
    firstPart?.text
  )?.content;
  if (typeof channelText === "string") {
    rememberChannel(videoId, channelText);
  }

  const durationFromOverlays = extractDurationFromLockupOverlays(viewModel);
  if (durationFromOverlays) {
    rememberDuration(videoId, durationFromOverlays);
  } else {
    const durationText = findDurationTextInNode(viewModel);
    if (durationText) {
      rememberDuration(videoId, durationText);
    }
  }
}

/**
 * @param {unknown} node
 * @param {number} depth
 */
function walkYtNode(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 40) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      walkYtNode(item, depth + 1);
    }
    return;
  }

  const obj = /** @type {Record<string, unknown>} */ (node);

  if (obj.videoRenderer) {
    indexVideoRenderer(/** @type {Record<string, unknown>} */ (obj.videoRenderer));
  }

  if (obj.lockupViewModel) {
    indexLockupViewModel(
      /** @type {Record<string, unknown>} */ (obj.lockupViewModel)
    );
  }

  if (obj.richItemRenderer) {
    const content = /** @type {Record<string, unknown>} */ (
      obj.richItemRenderer
    ).content;
    walkYtNode(content, depth + 1);
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      walkYtNode(value, depth + 1);
    }
  }
}

/**
 * @param {unknown} data
 */
function ingestYtData(data) {
  if (!data) return;
  walkYtNode(data);
}

/**
 * @param {string} text
 * @returns {unknown | null}
 */
function extractJsonAssignment(text, key) {
  const marker = `${key} = `;
  const startIdx = text.indexOf(marker);
  if (startIdx === -1) return null;

  const jsonStart = text.indexOf("{", startIdx + marker.length);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function ingestYtInitialDataFromScripts() {
  for (const script of document.scripts) {
    const text = script.textContent;
    if (!text?.includes("ytInitialData")) continue;

    const data = extractJsonAssignment(text, "ytInitialData");
    if (data) {
      ingestYtData(data);
      return;
    }
  }
}

function injectPageBridge() {
  if (bridgeInjected) return;
  bridgeInjected = true;

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("content/page-bridge.js");
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.addEventListener("load", () => {
    script.remove();
  });
}

function initAvatarCache() {
  ingestYtInitialDataFromScripts();
  injectPageBridge();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "attention-shield-yt-data") return;
    ingestYtData(event.data.data);
  });

  document.addEventListener("yt-navigate-finish", () => {
    avatarByVideoId.clear();
    avatarsByVideoId.clear();
    channelByVideoId.clear();
    durationByVideoId.clear();
    ingestYtInitialDataFromScripts();
  });

  document.addEventListener("yt-page-data-fetched", () => {
    ingestYtInitialDataFromScripts();
  });
}

/**
 * @param {string | null | undefined} videoId
 * @returns {string | null}
 */
function getAvatarForVideo(videoId) {
  if (!videoId) return null;
  return avatarByVideoId.get(videoId) ?? null;
}

/**
 * @param {string | null | undefined} videoId
 * @returns {string[]}
 */
function getAvatarsForVideo(videoId) {
  if (!videoId) return [];
  return avatarsByVideoId.get(videoId) ?? [];
}

/**
 * @param {string | null | undefined} videoId
 * @returns {string | null}
 */
function getChannelForVideo(videoId) {
  if (!videoId) return null;
  return channelByVideoId.get(videoId) ?? null;
}

/**
 * @param {string | null | undefined} videoId
 * @returns {string | null}
 */
function getDurationForVideo(videoId) {
  if (!videoId) return null;
  return durationByVideoId.get(videoId) ?? null;
}

/**
 * @param {() => void} callback
 */
function onAvatarCacheUpdate(callback) {
  updateCallbacks.add(callback);
}

window.AttentionShieldAvatarCache = {
  initAvatarCache,
  ingestYtData,
  refreshFromPage: ingestYtInitialDataFromScripts,
  getAvatarForVideo,
  getAvatarsForVideo,
  getChannelForVideo,
  getDurationForVideo,
  onAvatarCacheUpdate,
};
