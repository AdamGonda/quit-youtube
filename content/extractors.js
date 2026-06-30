/**
 * @typedef {Object} VideoMetadata
 * @property {string} title
 * @property {string} channel
 * @property {string} channelHref
 * @property {string} [avatarUrl]
 * @property {string[]} [avatarUrls]
 * @property {string} [views]
 * @property {string} [duration]
 * @property {string} href
 * @property {string} videoId
 */

const VIDEO_THUMB_PATTERN = /hqdefault|mqdefault|sddefault|maxresdefault|vi_webp/i;
const VIDEO_THUMB_URL_PATTERN = /\/vi(?:_webp)?\/|\/vi\//i;
const AVATAR_HOST_PATTERN = /(?:ggpht\.com|googleusercontent\.com|ytimg\.com\/ytc\/)/i;
const DURATION_PATTERN = /^\d{1,2}:\d{2}(:\d{2})?$/;
const LIVE_PATTERN = /^(LIVE|UPCOMING|PREMIERE)$/i;

/**
 * @param {string} text
 * @returns {boolean}
 */
function isDurationLike(text) {
  const trimmed = text.trim();
  return DURATION_PATTERN.test(trimmed) || LIVE_PATTERN.test(trimmed);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isValidTitle(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return false;
  if (isDurationLike(trimmed)) return false;
  return true;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isValidChannel(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (isDurationLike(trimmed)) return false;
  if (/^\d{1,2}:\d{2}(:\d{2})?/.test(trimmed)) return false;
  if (/\d[\d,.]*[KMB]?\s+views?/i.test(trimmed) && trimmed.length > 48) {
    return false;
  }
  return true;
}

/**
 * @param {Element} card
 * @returns {string}
 */
function findChannelFromMetadataRows(card) {
  const rowSelectors = [
    ".yt-content-metadata-view-model__metadata-row",
    ".yt-lockup-metadata-view-model .yt-content-metadata-view-model__metadata-row",
  ];

  for (const rowSelector of rowSelectors) {
    const rows = card.querySelectorAll(rowSelector);
    if (!rows.length) continue;

    const firstRow = rows[0];
    const channelText =
      firstRow
        .querySelector(".yt-content-metadata-view-model__metadata-text")
        ?.textContent?.trim() || firstRow.textContent?.trim() || "";

    if (isValidChannel(channelText)) {
      return channelText;
    }
  }

  const channelLink = findChannelLink(card);
  const fromLink = channelLink?.textContent?.trim() || "";
  if (isValidChannel(fromLink)) {
    return fromLink;
  }

  return "";
}

/**
 * @param {Element} card
 * @returns {string}
 */
function findViewsFromMetadataRows(card) {
  const rowSelectors = [
    ".yt-content-metadata-view-model__metadata-row",
    ".yt-lockup-metadata-view-model .yt-content-metadata-view-model__metadata-row",
  ];

  for (const rowSelector of rowSelectors) {
    const rows = card.querySelectorAll(rowSelector);
    if (!rows.length) continue;

    const lastRow = rows[rows.length - 1];
    const texts = lastRow.querySelectorAll(
      ".yt-content-metadata-view-model__metadata-text"
    );

    for (const el of texts) {
      const text = el.textContent?.trim() || "";
      if (/views?|watching/i.test(text)) {
        return text;
      }
    }
  }

  return "";
}

/**
 * @param {Element} card
 * @returns {string}
 */
function findTitle(card) {
  const selectors = [
    "#video-title",
    "#video-title-link",
    "a#video-title-link yt-formatted-string",
    "h3 a#video-title-link",
    "h3 yt-formatted-string",
    "h3 a",
    ".yt-lockup-metadata-view-model__title",
    ".yt-lockup-metadata-view-model__heading",
    ".yt-core-attributed-string--white-space-pre-wrap",
    "yt-formatted-string.ytd-video-meta-block",
  ];

  for (const selector of selectors) {
    const el = card.querySelector(selector);
    const fromAttr = el?.getAttribute("title")?.trim();
    if (fromAttr && isValidTitle(fromAttr)) {
      return fromAttr;
    }

    const fromText = el?.textContent?.trim();
    if (fromText && isValidTitle(fromText)) {
      return fromText;
    }
  }

  const watchLink = findWatchLink(card);
  if (watchLink) {
    const fromAttr = watchLink.getAttribute("title")?.trim();
    if (fromAttr && isValidTitle(fromAttr)) {
      return fromAttr;
    }

    const ariaLabel = watchLink.getAttribute("aria-label")?.trim();
    if (ariaLabel && isValidTitle(ariaLabel)) {
      return ariaLabel.replace(/\s+\d+\s+(minutes?|seconds?|hours?).*$/i, "").trim();
    }
  }

  const contentEl = card.querySelector("#content");
  if (contentEl) {
    const clone = /** @type {Element} */ (contentEl.cloneNode(true));
    clone
      .querySelectorAll(
        ".yt-content-metadata-view-model__metadata-text, ytd-badge-supported-renderer, .yt-badge-shape__text, #avatar, img"
      )
      .forEach((node) => node.remove());

    const text = clone.textContent?.replace(/\s+/g, " ").trim() || "";
    const viewsIdx = text.search(/\d[\d,.]*[KMB]?\s+views?/i);
    const candidate = viewsIdx > 0 ? text.slice(0, viewsIdx).trim() : text;
    if (isValidTitle(candidate)) {
      return candidate;
    }
  }

  return "";
}

/**
 * @param {string | null | undefined} href
 * @returns {string | null}
 */
function parseVideoId(href) {
  if (!href) return null;
  const match = href.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * @param {Element} card
 * @returns {HTMLAnchorElement | null}
 */
function findWatchLink(card) {
  const links = card.querySelectorAll('a[href*="/watch"]');
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (href.includes("/watch?v=") && !href.includes("/shorts/")) {
      return /** @type {HTMLAnchorElement} */ (link);
    }
  }
  return null;
}

/**
 * @param {Element} card
 * @returns {HTMLAnchorElement | null}
 */
function findChannelLink(card) {
  const selectors = [
    "ytd-channel-name a",
    "#channel-name a",
    'a[href^="/@"]',
    'a[href*="/channel/"]',
  ];

  for (const selector of selectors) {
    const link = card.querySelector(selector);
    if (link instanceof HTMLAnchorElement) {
      const href = link.getAttribute("href") || "";
      if (href.includes("/@") || href.includes("/channel/")) {
        return link;
      }
    }
  }

  return null;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isAvatarUrl(url) {
  if (!url || url.startsWith("data:")) return false;
  if (VIDEO_THUMB_PATTERN.test(url)) return false;
  if (VIDEO_THUMB_URL_PATTERN.test(url)) return false;
  return AVATAR_HOST_PATTERN.test(url);
}

/**
 * @param {string} srcset
 * @returns {string | null}
 */
function pickSrcFromSrcset(srcset) {
  const candidates = srcset
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const candidate = candidates[i];
    if (candidate && isAvatarUrl(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * @param {HTMLImageElement} img
 * @returns {string | null}
 */
function getImageSrc(img) {
  const candidates = [
    img.getAttribute("src"),
    img.currentSrc,
    img.getAttribute("data-src"),
    img.getAttribute("data-thumb"),
  ];

  for (const candidate of candidates) {
    if (candidate && isAvatarUrl(candidate)) {
      return candidate;
    }
  }

  const srcset = img.getAttribute("srcset") || "";
  if (srcset) {
    const fromSrcset = pickSrcFromSrcset(srcset);
    if (fromSrcset) {
      return fromSrcset;
    }
  }

  return null;
}

/**
 * @param {HTMLImageElement} img
 * @returns {boolean}
 */
function isInsideVideoThumbnail(img) {
  return Boolean(
    img.closest(
      'a[href*="/watch"], a[href*="/shorts/"], ytd-thumbnail, #thumbnail, .yt-lockup-view-model__content-image, .yt-lockup-view-model-wiz__content-image, .yt-lockup-view-model-wiz__content-image-wrapper'
    )
  );
}

/**
 * @param {Element} card
 * @returns {string | null}
 */
function scrapeAvatarFromHtml(card) {
  const html = card.innerHTML.replace(/&amp;/g, "&");
  const matches = html.matchAll(
    /https:\/\/(?:yt3\.)?(?:ggpht\.com|googleusercontent\.com|lh3\.googleusercontent\.com)\/[^\s"'<>\\]+/g
  );

  for (const match of matches) {
    const url = match[0];
    if (isAvatarUrl(url)) {
      return url;
    }
  }

  return null;
}

/**
 * @param {Element} card
 * @returns {string | null}
 */
function findAvatarBackgroundUrl(card) {
  const containers = card.querySelectorAll(
    ".yt-lockup-metadata-view-model__avatar, .yt-lockup-view-model__avatar, .yt-avatar-stack-view-model, .yt-decorated-avatar-stack-view-model, [class*='avatar-stack'], yt-avatar-shape, #avatar"
  );

  for (const container of containers) {
    if (!(container instanceof HTMLElement)) continue;

    const style = container.style.backgroundImage || getComputedStyle(container).backgroundImage;
    const match = style.match(/url\(["']?(https:\/\/[^"')]+)["']?\)/);
    if (match?.[1] && isAvatarUrl(match[1])) {
      return match[1];
    }
  }

  return null;
}

function findAvatarUrl(card, videoId) {
  const urls = findAvatarUrls(card, videoId);
  return urls[0] ?? null;
}

/**
 * @param {Element} card
 * @param {string | null | undefined} videoId
 * @returns {string[]}
 */
function findAvatarUrls(card, videoId) {
  const urls = [];

  const stackSelectors = [
    ".yt-avatar-stack-view-model img",
    ".yt-decorated-avatar-stack-view-model img",
    '[class*="avatar-stack"] img',
    '[class*="AvatarStack"] img',
  ];

  for (const selector of stackSelectors) {
    const images = card.querySelectorAll(selector);
    for (const img of images) {
      if (!(img instanceof HTMLImageElement)) continue;
      if (isInsideVideoThumbnail(img)) continue;
      const src = getImageSrc(img);
      if (src && !urls.includes(src)) {
        urls.push(src);
      }
    }
    if (urls.length) {
      return urls.slice(0, 4);
    }
  }

  const avatarContainers = [
    ".yt-lockup-metadata-view-model__avatar img",
    ".yt-lockup-view-model__avatar img",
    "yt-avatar-shape img",
    "ytd-channel-name #avatar img",
    "#avatar img",
    'a[href*="/@"] img',
    'a[href*="/channel/"] img',
    "img.yt-core-image",
  ];

  for (const selector of avatarContainers) {
    const images = card.querySelectorAll(selector);
    for (const img of images) {
      if (!(img instanceof HTMLImageElement)) continue;
      if (isInsideVideoThumbnail(img)) continue;
      const src = getImageSrc(img);
      if (src && !urls.includes(src)) {
        urls.push(src);
      }
    }
    if (urls.length) {
      return urls.slice(0, 4);
    }
  }

  const shadowImages = card.querySelectorAll("yt-img-shadow img");
  for (const img of shadowImages) {
    if (!(img instanceof HTMLImageElement)) continue;
    if (isInsideVideoThumbnail(img)) continue;
    const src = getImageSrc(img);
    if (src && !urls.includes(src)) {
      urls.push(src);
    }
  }

  if (urls.length) {
    return urls.slice(0, 4);
  }

  const images = card.querySelectorAll("img");
  for (const img of images) {
    if (!(img instanceof HTMLImageElement)) continue;
    if (isInsideVideoThumbnail(img)) continue;
    const src = getImageSrc(img);
    if (src && !urls.includes(src)) {
      urls.push(src);
    }
  }

  if (urls.length) {
    return urls.slice(0, 4);
  }

  const backgroundUrl = findAvatarBackgroundUrl(card);
  if (backgroundUrl) {
    urls.push(backgroundUrl);
    return urls;
  }

  const scraped = scrapeAvatarFromHtml(card);
  if (scraped) {
    urls.push(scraped);
    return urls;
  }

  if (videoId && window.AttentionShieldAvatarCache) {
    const cached = window.AttentionShieldAvatarCache.getAvatarsForVideo(videoId);
    if (cached.length) {
      return cached;
    }

    const single = window.AttentionShieldAvatarCache.getAvatarForVideo(videoId);
    if (single) {
      return [single];
    }
  }

  if (!videoId) {
    const watchLink = findWatchLink(card);
    const inferredId = parseVideoId(watchLink?.getAttribute("href") || "");
    if (inferredId && window.AttentionShieldAvatarCache) {
      const cached =
        window.AttentionShieldAvatarCache.getAvatarsForVideo(inferredId);
      if (cached.length) {
        return cached;
      }
    }
  }

  return [];
}

/**
 * @param {Element} card
 * @returns {string | null}
 */
function findDuration(card) {
  const liveBadge = card.querySelector(
    '.badge-style-type-live-now, .badge[aria-label="LIVE"], .badge-shape-wiz--thumbnail-live'
  );
  if (liveBadge) {
    return "LIVE";
  }

  const durationSelectors = [
    "ytd-thumbnail-overlay-time-status-renderer span",
    ".yt-badge-shape__text",
    "badge-shape .yt-badge-shape__text",
    "ytd-thumbnail-overlay-time-status-renderer",
  ];

  for (const selector of durationSelectors) {
    const el = card.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }

  return null;
}

/**
 * @param {Element} card
 * @param {string} videoId
 * @returns {{ channel: string, channelHref: string, avatarUrl?: string, avatarUrls?: string[], views?: string }}
 */
function extractChannelPresentation(card, videoId) {
  let channel = findChannelFromMetadataRows(card);
  if (!channel && window.AttentionShieldAvatarCache) {
    channel = window.AttentionShieldAvatarCache.getChannelForVideo(videoId) || "";
  }

  const channelLink = findChannelLink(card);
  const channelHref = channelLink?.getAttribute("href") || "";

  const avatarUrls = findAvatarUrls(card, videoId);
  const views = findViewsFromMetadataRows(card) || undefined;

  return {
    channel,
    channelHref,
    avatarUrl: avatarUrls[0],
    avatarUrls: avatarUrls.length > 1 ? avatarUrls : undefined,
    views,
  };
}

/**
 * @param {Element} card
 * @returns {VideoMetadata | null}
 */
function extractLegacy(card) {
  const watchLink = findWatchLink(card);
  if (!watchLink) return null;

  const videoId = parseVideoId(watchLink.getAttribute("href"));
  if (!videoId) return null;

  const title = findTitle(card);
  const presentation = extractChannelPresentation(card, videoId);
  let { channel, channelHref, avatarUrl, avatarUrls, views } = presentation;

  if (!views) {
    const metadataSpans = card.querySelectorAll("#metadata-line span");
    const spanViews = metadataSpans[0]?.textContent?.trim() || "";
    if (/views?|watching/i.test(spanViews)) {
      views = spanViews;
    }
  }

  const duration = findDuration(card) || undefined;

  if (!isValidTitle(title) || !isValidChannel(channel)) return null;

  return {
    title,
    channel,
    channelHref,
    avatarUrl,
    avatarUrls,
    views,
    duration,
    href: watchLink.getAttribute("href") || "",
    videoId,
  };
}

/**
 * @param {Element} card
 * @returns {VideoMetadata | null}
 */
function extractFlatLayout(card) {
  const watchLink = findWatchLink(card);
  if (!watchLink) return null;

  const videoId = parseVideoId(watchLink.getAttribute("href"));
  if (!videoId) return null;

  const title = findTitle(card);
  const presentation = extractChannelPresentation(card, videoId);
  let { channel, channelHref, avatarUrl, avatarUrls, views } = presentation;
  const duration = findDuration(card) || undefined;

  if (!isValidTitle(title)) return null;

  if (!isValidChannel(channel)) {
    return null;
  }

  if (!views) {
    const contentText = card.querySelector("#content")?.textContent || "";
    const viewsMatch = contentText.match(/([\d,.]+[KMB]?\s+views?)/i);
    if (viewsMatch) {
      views = viewsMatch[1];
    }
  }

  return {
    title,
    channel,
    channelHref,
    avatarUrl,
    avatarUrls,
    views,
    duration,
    href: watchLink.getAttribute("href") || "",
    videoId,
  };
}

/**
 * @param {Element} card
 * @returns {VideoMetadata | null}
 */
function extractLockup(card) {
  const watchLink = findWatchLink(card);
  if (!watchLink) return null;

  const videoId = parseVideoId(watchLink.getAttribute("href"));
  if (!videoId) return null;

  const title = findTitle(card);
  const presentation = extractChannelPresentation(card, videoId);
  let { channel, channelHref, avatarUrl, avatarUrls, views } = presentation;
  const duration = findDuration(card) || undefined;

  if (!views) {
    const contentText = card.textContent || "";
    const viewsMatch = contentText.match(
      /([\d,.]+[KMB]?\s+views?|[\d,.]+\s+watching)/i
    );
    if (viewsMatch) {
      views = viewsMatch[1];
    }
  }

  if (!isValidTitle(title) || !isValidChannel(channel)) return null;

  return {
    title,
    channel,
    channelHref,
    avatarUrl,
    avatarUrls,
    views,
    duration,
    href: watchLink.getAttribute("href") || "",
    videoId,
  };
}

/**
 * @param {Element} card
 * @returns {VideoMetadata | null}
 */
function extractVideoMetadata(card) {
  return (
    extractFlatLayout(card) ||
    extractLockup(card) ||
    extractLegacy(card)
  );
}

window.AttentionShieldExtractors = {
  extractVideoMetadata,
  parseVideoId,
  findWatchLink,
  findChannelLink,
  findAvatarUrl,
  findAvatarUrls,
};
