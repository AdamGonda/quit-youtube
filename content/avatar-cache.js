/** @type {Map<string, string>} */
const avatarByVideoId = new Map();
/** @type {Map<string, string[]>} */
const avatarsByVideoId = new Map();
/** @type {Map<string, string>} */
const channelByVideoId = new Map();

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
  onAvatarCacheUpdate,
};
