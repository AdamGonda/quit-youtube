(function attentionShieldPageBridge() {
  if (window.__attentionShieldFetchHooked) return;
  window.__attentionShieldFetchHooked = true;

  const ingestEndpoints = ["/youtubei/v1/browse", "/youtubei/v1/next"];

  /**
   * @param {string} url
   */
  function shouldIngest(url) {
    return ingestEndpoints.some((endpoint) => url.includes(endpoint));
  }

  /**
   * @param {unknown} data
   */
  function postData(data) {
    window.postMessage({ type: "attention-shield-yt-data", data }, "*");
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function attentionShieldFetch(...args) {
    const response = await originalFetch(...args);

    try {
      const requestUrl =
        typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof Request
            ? args[0].url
            : "";

      if (requestUrl && shouldIngest(requestUrl)) {
        response
          .clone()
          .json()
          .then(postData)
          .catch(() => {});
      }
    } catch {
      // Ignore parse/hook errors.
    }

    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function attentionShieldXhrOpen(
    method,
    url,
    ...rest
  ) {
    this.__attentionShieldUrl = typeof url === "string" ? url : String(url);
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function attentionShieldXhrSend(...args) {
    this.addEventListener("load", function attentionShieldXhrLoad() {
      try {
        const url = this.__attentionShieldUrl || "";
        if (!shouldIngest(url) || !this.responseText) return;
        postData(JSON.parse(this.responseText));
      } catch {
        // Ignore parse errors.
      }
    });

    return originalSend.apply(this, args);
  };
})();
