/** @typedef {import('./extractors.js').VideoMetadata} VideoMetadata */

const processedCards = new WeakSet();

/** @type {Element | null} */
let openArticleCard = null;

/** @type {boolean} */
let escapeListenerAttached = false;

/**
 * @param {Element} card
 * @returns {boolean}
 */
function isAdCard(card) {
  const tag = card.tagName.toLowerCase();
  if (tag.includes("ad")) return true;

  return Boolean(
    card.closest(
      "ytd-ad-slot-renderer, ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer"
    )
  );
}

/**
 * @param {Element} card
 * @returns {boolean}
 */
function isShortsCard(card) {
  if (card.getAttribute("is_short") === "true") return true;

  const shortsLink = card.querySelector('a[href^="/shorts/"]');
  if (shortsLink) return true;

  if (card.querySelector('badge-shape[aria-label="Shorts"]')) return true;
  if (card.querySelector("ytm-shorts-lockup-view-model")) return true;

  return Boolean(
    card.closest(
      'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-rich-shelf-renderer[is-shorts=""]'
    )
  );
}

/**
 * @param {Element} card
 * @returns {boolean}
 */
function isExploreTopicsCard(card) {
  return card.hasAttribute("data-attention-shield-hide");
}

function isSurveyCard(card) {
  if (
    card.matches(
      "ytd-inline-survey-renderer, ytd-single-option-survey-renderer, ytd-feedback-survey-renderer"
    )
  ) {
    return true;
  }

  return Boolean(
    card.querySelector(
      "ytd-inline-survey-renderer, ytd-single-option-survey-renderer, ytd-feedback-survey-renderer, #attached-survey"
    )
  );
}

/**
 * @param {Element} card
 * @returns {boolean}
 */
function isVideoCard(card) {
  if (isAdCard(card)) return false;
  if (isShortsCard(card)) return false;
  if (isSurveyCard(card)) return false;
  if (isExploreTopicsCard(card)) return false;

  const watchLink = window.AttentionShieldExtractors.findWatchLink(card);
  return watchLink !== null;
}

/**
 * @param {Element} card
 * @returns {boolean}
 */
function isProcessed(card) {
  return processedCards.has(card) || card.hasAttribute("data-attention-shield");
}

/**
 * @param {Element} card
 */
function markProcessed(card) {
  processedCards.add(card);
  card.setAttribute("data-attention-shield", "1");
  card.removeAttribute("data-attention-shield-pending");
}

/**
 * @param {Element} card
 */
function unmarkProcessed(card) {
  processedCards.delete(card);
  card.removeAttribute("data-attention-shield");
  card.removeAttribute("data-attention-shield-pending");
}

/**
 * @param {string} channel
 * @returns {string}
 */
function getInitials(channel) {
  const trimmed = channel.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

/**
 * @param {HTMLElement} avatarLink
 * @param {string} url
 * @param {string} channel
 */
function applyAvatarImage(avatarLink, url, channel) {
  avatarLink.replaceChildren();
  avatarLink.classList.remove("as-avatar-stack");

  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.width = 32;
  img.height = 32;
  img.loading = "lazy";
  img.addEventListener("error", () => {
    avatarLink.replaceChildren();
    const fallback = document.createElement("span");
    fallback.className = "as-avatar-fallback";
    fallback.textContent = getInitials(channel);
    avatarLink.appendChild(fallback);
  });
  avatarLink.appendChild(img);
}

/**
 * @param {HTMLElement} avatarLink
 * @param {string[]} urls
 * @param {string} channel
 */
function applyAvatarStack(avatarLink, urls, channel) {
  avatarLink.replaceChildren();
  avatarLink.classList.add("as-avatar-stack");

  const stack = document.createElement("span");
  stack.className = "as-avatar-stack-inner";

  for (const url of urls.slice(0, 3)) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.width = 24;
    img.height = 24;
    img.loading = "lazy";
    stack.appendChild(img);
  }

  avatarLink.appendChild(stack);

  if (!stack.querySelector("img")) {
    avatarLink.classList.remove("as-avatar-stack");
    const fallback = document.createElement("span");
    fallback.className = "as-avatar-fallback";
    fallback.textContent = getInitials(channel);
    avatarLink.appendChild(fallback);
  }
}

/**
 * @param {HTMLElement} avatarLink
 * @param {VideoMetadata} metadata
 */
function applyAvatars(avatarLink, metadata) {
  if (metadata.avatarUrls && metadata.avatarUrls.length > 1) {
    applyAvatarStack(avatarLink, metadata.avatarUrls, metadata.channel);
    return;
  }

  if (metadata.avatarUrl) {
    applyAvatarImage(avatarLink, metadata.avatarUrl, metadata.channel);
    return;
  }

  const fallback = document.createElement("span");
  fallback.className = "as-avatar-fallback";
  fallback.textContent = getInitials(metadata.channel);
  avatarLink.appendChild(fallback);
}

/**
 * @param {HTMLElement} bodyEl
 * @param {string} message
 * @param {boolean} isError
 */
function setArticleBodyMessage(bodyEl, message, isError = false) {
  bodyEl.replaceChildren();
  bodyEl.classList.toggle("as-article-body-error", isError);

  const paragraph = document.createElement("p");
  paragraph.className = isError
    ? "as-article-message as-article-message-error"
    : "as-article-message";
  paragraph.textContent = message;
  bodyEl.appendChild(paragraph);
}

/**
 * @param {HTMLElement} bodyEl
 * @param {string[]} paragraphs
 */
function renderArticleBody(bodyEl, paragraphs) {
  bodyEl.replaceChildren();
  bodyEl.classList.remove("as-article-body-error");

  for (const text of paragraphs) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    bodyEl.appendChild(paragraph);
  }
}

/**
 * @param {Element} card
 */
function closeArticle(card) {
  const cardEl = card.querySelector(":scope > .as-card");
  if (!cardEl) return;

  cardEl.classList.remove("as-article-open");
  card.removeAttribute("data-attention-shield-article");

  const titleLink = cardEl.querySelector(".as-title");
  if (titleLink instanceof HTMLAnchorElement) {
    titleLink.removeAttribute("aria-disabled");
    titleLink.classList.remove("as-title-loading");
  }

  if (openArticleCard === card) {
    openArticleCard = null;
  }
}

function closeOpenArticle() {
  if (openArticleCard) {
    closeArticle(openArticleCard);
  }
}

function ensureEscapeListener() {
  if (escapeListenerAttached) return;
  escapeListenerAttached = true;

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeOpenArticle();
  });
}

/**
 * @param {Element} card
 * @param {VideoMetadata} metadata
 */
async function openArticle(card, metadata) {
  const cardEl = card.querySelector(":scope > .as-card");
  if (!cardEl) return;

  if (openArticleCard && openArticleCard !== card) {
    closeArticle(openArticleCard);
  }

  ensureEscapeListener();

  cardEl.classList.add("as-article-open");
  card.setAttribute("data-attention-shield-article", "1");
  openArticleCard = card;

  const titleLink = cardEl.querySelector(".as-title");
  if (titleLink instanceof HTMLAnchorElement) {
    titleLink.setAttribute("aria-disabled", "true");
    titleLink.classList.add("as-title-loading");
  }

  const articleHeaderTitle = cardEl.querySelector(".as-article-title");
  const articleHeaderChannel = cardEl.querySelector(".as-article-channel");
  const articleBody = cardEl.querySelector(".as-article-body");

  if (articleHeaderTitle) {
    articleHeaderTitle.textContent = metadata.title;
  }
  if (articleHeaderChannel) {
    articleHeaderChannel.textContent = metadata.channel;
  }
  if (articleBody instanceof HTMLElement) {
    setArticleBodyMessage(articleBody, "Loading transcript…", false);
  }

  const segments = await window.AttentionShieldTranscripts.fetchTranscript(
    metadata.videoId
  );

  if (!cardEl.classList.contains("as-article-open")) {
    return;
  }

  if (titleLink instanceof HTMLAnchorElement) {
    titleLink.removeAttribute("aria-disabled");
    titleLink.classList.remove("as-title-loading");
  }

  if (!(articleBody instanceof HTMLElement)) return;

  if (!segments?.length) {
    setArticleBodyMessage(
      articleBody,
      "No transcript available",
      true
    );
    return;
  }

  const paragraphs = window.AttentionShieldTranscripts.formatArticleBody(
    segments
  );

  if (!paragraphs.length) {
    setArticleBodyMessage(
      articleBody,
      "No transcript available",
      true
    );
    return;
  }

  renderArticleBody(articleBody, paragraphs);
}

/**
 * @param {HTMLElement} cardEl
 * @param {Element} parentCard
 * @param {VideoMetadata} metadata
 */
function wireArticleControls(cardEl, parentCard, metadata) {
  const titleLink = cardEl.querySelector(".as-title");
  if (titleLink instanceof HTMLAnchorElement) {
    titleLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (titleLink.classList.contains("as-title-loading")) return;
      void openArticle(parentCard, metadata);
    });
  }

  const closeButton = cardEl.querySelector(".as-article-close");
  if (closeButton instanceof HTMLButtonElement) {
    closeButton.addEventListener("click", () => {
      closeArticle(parentCard);
    });
  }
}

/**
 * @param {VideoMetadata} metadata
 * @returns {HTMLElement}
 */
function buildCardElement(metadata) {
  const card = document.createElement("div");
  card.className = "as-card";

  const titleLink = document.createElement("a");
  titleLink.className = "as-title";
  titleLink.href = metadata.href;
  titleLink.textContent = metadata.title;
  titleLink.title = metadata.title;
  titleLink.setAttribute("role", "button");

  const footer = document.createElement("div");
  footer.className = "as-footer";

  const avatarLink = document.createElement("a");
  avatarLink.className = "as-avatar";
  avatarLink.href = metadata.channelHref || "#";
  avatarLink.setAttribute("aria-label", metadata.channel);
  avatarLink.title = metadata.channel;

  applyAvatars(avatarLink, metadata);

  const metaCol = document.createElement("div");
  metaCol.className = "as-meta-col";

  const channelSpan = document.createElement("span");
  channelSpan.className = "as-channel";
  channelSpan.textContent = metadata.channel;

  metaCol.appendChild(channelSpan);

  footer.appendChild(avatarLink);
  footer.appendChild(metaCol);

  const article = document.createElement("article");
  article.className = "as-article";

  const articleHeader = document.createElement("header");
  articleHeader.className = "as-article-header";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "as-article-close";
  closeButton.textContent = "Close";
  closeButton.setAttribute("aria-label", "Close transcript");

  const articleTitle = document.createElement("h2");
  articleTitle.className = "as-article-title";
  articleTitle.textContent = metadata.title;

  const articleChannel = document.createElement("p");
  articleChannel.className = "as-article-channel";
  articleChannel.textContent = metadata.channel;

  articleHeader.appendChild(closeButton);
  articleHeader.appendChild(articleTitle);
  articleHeader.appendChild(articleChannel);

  const articleBody = document.createElement("div");
  articleBody.className = "as-article-body";

  article.appendChild(articleHeader);
  article.appendChild(articleBody);

  card.appendChild(titleLink);

  if (metadata.views || metadata.duration) {
    const viewsEl = document.createElement("div");
    viewsEl.className = "as-views-prominent";

    if (metadata.views) {
      const viewsSpan = document.createElement("span");
      viewsSpan.className = "as-views-text";
      viewsSpan.textContent = metadata.views;
      viewsEl.appendChild(viewsSpan);
    }

    if (metadata.views && metadata.duration) {
      viewsEl.appendChild(createSeparator());
    }

    if (metadata.duration) {
      const durationSpan = document.createElement("span");
      durationSpan.className = "as-duration-prominent";
      durationSpan.textContent = metadata.duration;
      viewsEl.appendChild(durationSpan);
    }

    card.appendChild(viewsEl);
  }

  card.appendChild(footer);
  card.appendChild(article);

  return card;
}

/**
 * @returns {HTMLSpanElement}
 */
function createSeparator() {
  const sep = document.createElement("span");
  sep.className = "as-sep";
  sep.textContent = "·";
  sep.setAttribute("aria-hidden", "true");
  return sep;
}

/**
 * @param {HTMLElement} cardEl
 * @param {string} duration
 */
function applyDurationToCard(cardEl, duration) {
  if (!duration || cardEl.querySelector(".as-duration-prominent")) return;

  let statsEl = cardEl.querySelector(".as-views-prominent");
  if (!statsEl) {
    statsEl = document.createElement("div");
    statsEl.className = "as-views-prominent";
    const footer = cardEl.querySelector(".as-footer");
    if (footer) {
      cardEl.insertBefore(statsEl, footer);
    } else {
      cardEl.appendChild(statsEl);
    }
  }

  if (statsEl.querySelector(".as-views-text")) {
    statsEl.appendChild(createSeparator());
  }

  const durationSpan = document.createElement("span");
  durationSpan.className = "as-duration-prominent";
  durationSpan.textContent = duration;
  statsEl.appendChild(durationSpan);
}

/**
 * @param {Element} card
 * @param {HTMLElement} cardEl
 * @param {Element} contentRoot
 * @param {string} videoId
 */
function scheduleDurationUpgrade(card, cardEl, contentRoot, videoId) {
  if (cardEl.querySelector(".as-duration-prominent")) return;

  const tryUpgrade = () => {
    const duration = window.AttentionShieldExtractors.findDuration(card, videoId);
    if (!duration) return false;
    applyDurationToCard(cardEl, duration);
    return true;
  };

  if (tryUpgrade()) return;

  const observer = new MutationObserver(() => {
    if (tryUpgrade()) {
      observer.disconnect();
    }
  });

  observer.observe(contentRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "title"],
    characterData: true,
  });

  window.setTimeout(() => {
    observer.disconnect();
    tryUpgrade();
  }, 5000);
}

/**
 * @param {Element} card
 * @param {HTMLElement} cardEl
 * @param {Element} contentRoot
 * @param {string} channel
 * @param {string} videoId
 */
function scheduleAvatarUpgrade(card, cardEl, contentRoot, channel, videoId) {
  let settled = false;

  const finish = () => {
    if (settled) return;
    settled = true;
    contentRoot.setAttribute("hidden", "");
  };

  const tryUpgrade = () => {
    const urls = window.AttentionShieldExtractors.findAvatarUrls(card, videoId);
    if (!urls.length) return false;

    const avatarLink = cardEl.querySelector(".as-avatar");
    if (avatarLink) {
      if (urls.length > 1) {
        applyAvatarStack(avatarLink, urls, channel);
      } else {
        applyAvatarImage(avatarLink, urls[0], channel);
      }
    }

    finish();
    return true;
  };

  if (tryUpgrade()) return;

  const observer = new MutationObserver(() => {
    if (tryUpgrade()) {
      observer.disconnect();
    }
  });

  observer.observe(contentRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "data-src"],
  });

  window.setTimeout(() => {
    observer.disconnect();
    tryUpgrade();
    finish();
  }, 5000);
}

/**
 * @param {Element} card
 * @param {VideoMetadata} metadata
 */
function injectCard(card, metadata) {
  const existing = card.querySelector(":scope > .as-card");
  if (existing) {
    existing.remove();
  }

  if (!metadata.avatarUrl && !metadata.avatarUrls?.length) {
    const retryUrls = window.AttentionShieldExtractors.findAvatarUrls(
      card,
      metadata.videoId
    );
    if (retryUrls.length === 1) {
      metadata.avatarUrl = retryUrls[0];
    } else if (retryUrls.length > 1) {
      metadata.avatarUrls = retryUrls;
      metadata.avatarUrl = retryUrls[0];
    }
  }

  const contentRoot =
    card.querySelector("#content") ||
    card.querySelector("#dismissible") ||
    card;

  card.setAttribute("data-video-id", metadata.videoId);

  const cardEl = buildCardElement(metadata);
  wireArticleControls(cardEl, card, metadata);
  card.appendChild(cardEl);

  if (contentRoot !== card) {
    if (!metadata.duration) {
      scheduleDurationUpgrade(card, cardEl, contentRoot, metadata.videoId);
    }

    if (!metadata.avatarUrl && !metadata.avatarUrls?.length) {
      scheduleAvatarUpgrade(
        card,
        cardEl,
        contentRoot,
        metadata.channel,
        metadata.videoId
      );
    } else {
      contentRoot.setAttribute("hidden", "");
    }
  }
}

/**
 * @param {Element} card
 * @returns {boolean}
 */
function transformCard(card) {
  if (!isVideoCard(card)) return false;
  if (isProcessed(card)) return false;

  card.setAttribute("data-attention-shield-pending", "");

  const metadata = window.AttentionShieldExtractors.extractVideoMetadata(card);
  if (!metadata) {
    card.removeAttribute("data-attention-shield-pending");
    return false;
  }

  if (!metadata.title || !metadata.channel) {
    card.removeAttribute("data-attention-shield-pending");
    return false;
  }

  injectCard(card, metadata);
  markProcessed(card);
  return true;
}

/**
 * @param {Element} card
 */
function restoreCard(card) {
  if (openArticleCard === card) {
    openArticleCard = null;
  }

  card.removeAttribute("data-attention-shield-article");
  card.removeAttribute("data-video-id");

  const injected = card.querySelector(":scope > .as-card");
  if (injected) {
    injected.remove();
  }

  const contentRoot =
    card.querySelector("#content") ||
    card.querySelector("#dismissible");
  if (contentRoot) {
    contentRoot.removeAttribute("hidden");
  }

  unmarkProcessed(card);
}

function closeAllArticles() {
  closeOpenArticle();
}

function upgradePendingAvatars() {
  if (!window.AttentionShieldState?.enabled) return;

  const cards = document.querySelectorAll("[data-attention-shield]");
  for (const card of cards) {
    const asCard = card.querySelector(":scope > .as-card");
    if (!asCard) continue;

    const channel =
      asCard.querySelector(".as-channel")?.textContent?.trim() || "";
    const watchLink = window.AttentionShieldExtractors.findWatchLink(card);
    const videoId =
      window.AttentionShieldExtractors.parseVideoId(
        watchLink?.getAttribute("href") || ""
      ) || "";

    const urls = window.AttentionShieldExtractors.findAvatarUrls(card, videoId);
    const cachedChannel =
      window.AttentionShieldAvatarCache?.getChannelForVideo(videoId) || "";
    const cachedDuration =
      window.AttentionShieldAvatarCache?.getDurationForVideo(videoId) || "";
    const channelEl = asCard.querySelector(".as-channel");

    if (channelEl && cachedChannel) {
      channelEl.textContent = cachedChannel;
    }

    const displayChannel = cachedChannel || channel;

    if (asCard.querySelector(".as-avatar-fallback") && urls.length) {
      const avatarLink = asCard.querySelector(".as-avatar");
      if (avatarLink) {
        if (urls.length > 1) {
          applyAvatarStack(avatarLink, urls, displayChannel);
        } else {
          applyAvatarImage(avatarLink, urls[0], displayChannel);
        }
      }
    }

    if (!asCard.querySelector(".as-duration-prominent")) {
      const duration =
        cachedDuration ||
        window.AttentionShieldExtractors.findDuration(card, videoId);
      if (duration) {
        applyDurationToCard(asCard, duration);
      }
    }

    const contentRoot =
      card.querySelector("#content") || card.querySelector("#dismissible");
    contentRoot?.setAttribute("hidden", "");
  }
}

/**
 * @param {ParentNode} root
 */
function restoreAllCards(root = document) {
  openArticleCard = null;

  const cards = root.querySelectorAll("[data-attention-shield]");
  for (const card of cards) {
    restoreCard(card);
  }
}

window.AttentionShieldTransform = {
  isVideoCard,
  isAdCard,
  isShortsCard,
  isProcessed,
  transformCard,
  restoreCard,
  restoreAllCards,
  upgradePendingAvatars,
  closeAllArticles,
};
