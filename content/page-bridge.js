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

  /**
   * @returns {string | null}
   */
  function getInnertubeApiKey() {
    try {
      const key = window.ytcfg?.get?.("INNERTUBE_API_KEY");
      if (typeof key === "string" && key.length > 0) return key;
    } catch {
      // Ignore ytcfg access errors.
    }
    return null;
  }

  /**
   * @param {string} requestId
   * @param {boolean} ok
   * @param {Array<{ startMs: number, text: string }> | undefined} segments
   * @param {string | undefined} error
   */
  function postTranscriptResult(requestId, ok, segments, error) {
    window.postMessage(
      {
        type: "attention-shield-transcript-result",
        requestId,
        ok,
        segments,
        error,
      },
      "*"
    );
  }

  /**
   * @param {unknown} captionData
   * @returns {Array<{ startMs: number, text: string }>}
   */
  function parseJson3Captions(captionData) {
    if (!captionData || typeof captionData !== "object") return [];

    const events = /** @type {{ events?: unknown[] }} */ (captionData).events;
    if (!Array.isArray(events)) return [];

    /** @type {Array<{ startMs: number, text: string }>} */
    const segments = [];

    for (const event of events) {
      if (!event || typeof event !== "object") continue;
      const record = /** @type {Record<string, unknown>} */ (event);
      const segs = record.segs;
      if (!Array.isArray(segs)) continue;

      let text = "";
      for (const seg of segs) {
        if (!seg || typeof seg !== "object") continue;
        const utf8 = /** @type {{ utf8?: string }} */ (seg).utf8;
        if (utf8) text += utf8;
      }

      text = text.replace(/\n+/g, " ").trim();
      if (!text) continue;

      const startMs =
        typeof record.tStartMs === "number" ? record.tStartMs : 0;
      segments.push({ startMs, text });
    }

    return segments;
  }

  /**
   * @param {Array<{ languageCode?: string, baseUrl?: string }>} tracks
   * @returns {{ languageCode?: string, baseUrl?: string } | null}
   */
  function pickCaptionTrack(tracks) {
    if (!tracks.length) return null;

    const english =
      tracks.find((track) => track.languageCode === "en") ||
      tracks.find((track) => track.languageCode?.startsWith("en")) ||
      null;

    return english || tracks[0] || null;
  }

  /**
   * @param {string} videoId
   * @returns {Promise<Array<{ startMs: number, text: string }>>}
   */
  async function fetchTranscriptSegments(videoId) {
    const apiKey = getInnertubeApiKey();
    if (!apiKey) {
      throw new Error("INNERTUBE_API_KEY not available");
    }

    const playerResponse = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "20.10.38",
              hl: "en",
              gl: "US",
            },
          },
          videoId,
        }),
      }
    );

    if (!playerResponse.ok) {
      throw new Error(`Player request failed (${playerResponse.status})`);
    }

    const playerData = await playerResponse.json();
    const tracks =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new Error("NO_CAPTIONS");
    }

    const track = pickCaptionTrack(tracks);
    if (!track?.baseUrl) {
      throw new Error("NO_CAPTIONS");
    }

    const captionUrl = new URL(track.baseUrl, window.location.origin);
    captionUrl.searchParams.delete("fmt");
    captionUrl.searchParams.set("fmt", "json3");

    const captionResponse = await fetch(captionUrl.toString());
    if (!captionResponse.ok) {
      throw new Error(`Caption request failed (${captionResponse.status})`);
    }

    const captionData = await captionResponse.json();
    const segments = parseJson3Captions(captionData);

    if (!segments.length) {
      throw new Error("NO_CAPTIONS");
    }

    return segments;
  }

  /** @type {Map<string, Promise<Array<{ startMs: number, text: string }>>>} */
  const inFlightTranscripts = new Map();

  /**
   * @param {string} requestId
   * @param {string} videoId
   */
  async function handleTranscriptRequest(requestId, videoId) {
    try {
      let pending = inFlightTranscripts.get(videoId);
      if (!pending) {
        pending = fetchTranscriptSegments(videoId).finally(() => {
          inFlightTranscripts.delete(videoId);
        });
        inFlightTranscripts.set(videoId, pending);
      }

      const segments = await pending;
      postTranscriptResult(requestId, true, segments, undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transcript fetch failed";
      postTranscriptResult(requestId, false, undefined, message);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "attention-shield-fetch-transcript") return;

    const requestId = event.data.requestId;
    const videoId = event.data.videoId;

    if (typeof requestId !== "string" || typeof videoId !== "string") return;
    if (!videoId) return;

    void handleTranscriptRequest(requestId, videoId);
  });

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
