/** @type {string[]} */
const HIDDEN_SECTION_TITLES = ["Explore more topics"];

/** @type {string} */
const PREMIUM_PROMO_SELECTOR = [
  "ytd-ad-slot-renderer",
  "ytd-in-feed-ad-layout-renderer",
  "ytd-banner-promo-renderer",
  "ytd-display-ad-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-compact-promoted-video-renderer",
  "ytd-compact-promoted-item-renderer",
].join(", ");

/**
 * @param {Element} element
 * @returns {boolean}
 */
function isPremiumPromoItem(element) {
  if (element.querySelector(PREMIUM_PROMO_SELECTOR)) {
    return true;
  }

  if (element.querySelector('a[href*="/premium"]')) {
    return true;
  }

  if (
    element.querySelector(
      '.badge[aria-label="Premium"], badge-shape[aria-label="Premium"], ytd-badge-supported-renderer#featured-badge'
    )
  ) {
    return true;
  }

  const text = element.textContent?.replace(/\s+/g, " ").trim() || "";
  if (/youtube featured/i.test(text) && /youtube premium/i.test(text)) {
    return true;
  }

  if (/download,?\s+watch offline/i.test(text) && /youtube premium/i.test(text)) {
    return true;
  }

  const watchLinks = element.querySelectorAll('a[href*="/watch?v="]');
  if (watchLinks.length >= 2 && /youtube premium|try \d+ month/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * @param {Element} element
 * @returns {string}
 */
function getShelfTitle(element) {
  const candidates = element.querySelectorAll(
    "yt-shelf-header-layout h2, ytd-rich-shelf-renderer #title, #title-container #title, #title"
  );

  for (const el of candidates) {
    const text = el.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return "";
}

/**
 * @param {Element} element
 * @returns {boolean}
 */
function shouldHideFeedItem(element) {
  if (isPremiumPromoItem(element)) {
    return true;
  }

  const title = getShelfTitle(element);
  if (title && HIDDEN_SECTION_TITLES.some((hidden) => title.includes(hidden))) {
    return true;
  }

  const hasTopicChips = Boolean(
    element.querySelector(".ytChipsShelfViewModelHost, grid-shelf-view-model")
  );
  const hasWatchLink = Boolean(element.querySelector('a[href*="/watch?v="]'));

  return hasTopicChips && !hasWatchLink;
}

function cleanupFeed() {
  const enabled = Boolean(window.AttentionShieldState?.enabled);
  const items = document.querySelectorAll(
    "ytd-rich-section-renderer, ytd-rich-item-renderer"
  );

  for (const item of items) {
    if (!enabled) {
      item.removeAttribute("data-attention-shield-hide");
      continue;
    }

    item.toggleAttribute("data-attention-shield-hide", shouldHideFeedItem(item));
  }
}

window.AttentionShieldFeedCleanup = {
  cleanupFeed,
  isPremiumPromoItem,
};
