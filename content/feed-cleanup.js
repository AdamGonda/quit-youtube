/** @type {string[]} */
const HIDDEN_SECTION_TITLES = ["Explore more topics"];

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
};
