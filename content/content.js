/** @type {{ enabled: boolean }} */
if (!window.AttentionShieldState) {
  window.AttentionShieldState = {
    enabled: true,
  };
}

const ACTIVE_CLASS = "attention-shield-active";

/**
 * @param {boolean} enabled
 */
function setEnabled(enabled) {
  window.AttentionShieldState.enabled = enabled;
  document.documentElement.classList.toggle(ACTIVE_CLASS, enabled);

  if (enabled) {
    window.AttentionShieldObserver.refresh();
  } else {
    window.AttentionShieldTransform.restoreAllCards(document);
    window.AttentionShieldObserver.refresh();
  }
}

function init() {
  window.AttentionShieldAvatarCache.initAvatarCache();
  window.AttentionShieldAvatarCache.onAvatarCacheUpdate(() => {
    window.AttentionShieldTransform.upgradePendingAvatars();
  });

  chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
    setEnabled(enabled);
    window.AttentionShieldObserver.initObserver();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.enabled) return;
    setEnabled(Boolean(changes.enabled.newValue));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
