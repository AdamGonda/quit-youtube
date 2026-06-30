/** @typedef {{ cardSelector: string, feedSelector: string }} RouteConfig */

/** @type {RouteConfig[]} */
const ATTENTION_SHIELD_ROUTES = [
  {
    cardSelector: "ytd-rich-item-renderer",
    feedSelector: "ytd-rich-grid-renderer #contents",
  },
  {
    cardSelector: "ytd-video-renderer",
    feedSelector: "ytd-search #container",
  },
];

/**
 * @returns {RouteConfig | null}
 */
function getActiveRouteConfig() {
  if (document.querySelector("ytd-search")) {
    return ATTENTION_SHIELD_ROUTES[1];
  }

  if (document.querySelector("ytd-rich-grid-renderer")) {
    return ATTENTION_SHIELD_ROUTES[0];
  }

  return null;
}

window.AttentionShieldCardTypes = {
  ATTENTION_SHIELD_ROUTES,
  getActiveRouteConfig,
};
