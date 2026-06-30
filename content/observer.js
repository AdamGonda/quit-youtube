let generation = 0;
let feedObserver = null;
let debounceTimer = null;

/**
 * @param {() => void} fn
 * @param {number} delay
 * @returns {() => void}
 */
function debounce(fn, delay) {
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(fn, delay);
  };
}

/**
 * @param {Element | Document | DocumentFragment} root
 * @param {string} selector
 * @returns {Element[]}
 */
function queryAll(root, selector) {
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) {
    return [];
  }
  return Array.from(root.querySelectorAll(selector));
}

/**
 * @param {Element[]} roots
 * @param {number} currentGeneration
 */
function processCardRoots(roots, currentGeneration) {
  if (currentGeneration !== generation) return;
  if (!window.AttentionShieldState?.enabled) return;

  const config = window.AttentionShieldCardTypes.getActiveRouteConfig();
  if (!config) return;

  const seen = new Set();

  for (const root of roots) {
    const candidates =
      root instanceof Element && root.matches(config.cardSelector)
        ? [root]
        : queryAll(root, config.cardSelector);

    for (const card of candidates) {
      if (seen.has(card)) continue;
      seen.add(card);

      if (currentGeneration !== generation) return;
      window.AttentionShieldTransform.transformCard(card);
    }
  }
}

/**
 * @param {number} currentGeneration
 */
function processVisibleCards(currentGeneration) {
  if (currentGeneration !== generation) return;
  if (!window.AttentionShieldState?.enabled) return;

  window.AttentionShieldFeedCleanup?.cleanupFeed?.();

  const config = window.AttentionShieldCardTypes.getActiveRouteConfig();
  if (!config) return;

  processCardRoots([document], currentGeneration);
  window.AttentionShieldTransform.upgradePendingAvatars();
}

/**
 * @param {number} currentGeneration
 */
function setupFeedObserver(currentGeneration) {
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }

  if (currentGeneration !== generation) return;
  if (!window.AttentionShieldState?.enabled) return;

  const config = window.AttentionShieldCardTypes.getActiveRouteConfig();
  if (!config) return;

  const feedRoot = document.querySelector(config.feedSelector);
  if (!feedRoot) {
    window.setTimeout(() => {
      if (currentGeneration === generation) {
        setupFeedObserver(currentGeneration);
      }
    }, 500);
    return;
  }

  processVisibleCards(currentGeneration);

  const debouncedProcess = debounce(
    () => processVisibleCards(currentGeneration),
    100
  );

  feedObserver = new MutationObserver((mutations) => {
    if (currentGeneration !== generation) return;
    if (!window.AttentionShieldState?.enabled) return;

    const addedRoots = [];
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          addedRoots.push(node);
        }
      }
    }

    if (addedRoots.length > 0) {
      window.AttentionShieldFeedCleanup?.cleanupFeed?.();
      processCardRoots(addedRoots, currentGeneration);
      window.AttentionShieldTransform.upgradePendingAvatars();
    }

    debouncedProcess();
  });

  feedObserver.observe(feedRoot, {
    childList: true,
    subtree: true,
  });
}

function onRouteChange() {
  generation += 1;
  const currentGeneration = generation;

  window.setTimeout(() => {
    if (currentGeneration !== generation) return;
    setupFeedObserver(currentGeneration);
  }, 200);
}

function initObserver() {
  document.addEventListener("yt-navigate-finish", onRouteChange);
  document.addEventListener("yt-page-data-fetched", onRouteChange);
  window.addEventListener("pagehide", () => {
    if (feedObserver) {
      feedObserver.disconnect();
    }
  });

  onRouteChange();
}

function refresh() {
  generation += 1;
  const currentGeneration = generation;

  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }

  if (!window.AttentionShieldState?.enabled) {
    window.AttentionShieldTransform.restoreAllCards(document);
    window.AttentionShieldFeedCleanup?.cleanupFeed?.();
    return;
  }

  setupFeedObserver(currentGeneration);
}

window.AttentionShieldObserver = {
  initObserver,
  refresh,
  processVisibleCards,
};
