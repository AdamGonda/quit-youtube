# Chrome Web Store listing (copy/paste)

Use this when submitting at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Links

| Field | URL |
|-------|-----|
| Privacy policy | https://github.com/AdamGonda/attention-shield/blob/main/PRIVACY.md |
| Homepage / support | https://github.com/AdamGonda/attention-shield |

## Short description (≤ 132 chars)

Read YouTube like an article. Hide thumbnails, open transcripts inline, and toggle text-only mode from the toolbar.

## Detailed description

**Take back your attention on YouTube.**

Quit YouTube turns your feed into a calm, text-first reading experience:

- **No thumbnails** — homepage, search, subscriptions, and channel video tabs show compact text cards instead
- **Read transcripts like articles** — click a title to open the transcript inline (no autoplay rabbit hole)
- **Hide Shorts shelves** — fewer distractions while you browse
- **Toggle anytime** — use the toolbar popup to turn text-only mode on or off

Works with infinite scroll and YouTube's single-page navigation.

### How to use

1. Install the extension
2. Open [youtube.com](https://www.youtube.com)
3. Click the Quit YouTube icon to enable or disable text-only mode
4. Click a **title** to read the transcript; press Escape or **Close** to return

### Permissions

- **Storage** — saves your on/off preference locally in Chrome

No data is collected or sent to any server. See our [privacy policy](https://github.com/AdamGonda/attention-shield/blob/main/PRIVACY.md).

## Category

Productivity

## Permission justifications (dashboard form)

**storage**

Saves whether text-only mode is enabled so your preference persists across sessions.

**Host access: https://www.youtube.com/***

Required to transform the YouTube UI, hide thumbnails, and display transcripts on pages you visit.

## Single purpose

Transforms YouTube into a text-first reading experience to reduce visual distraction and autoplay.

## Screenshots to capture

Chrome Web Store **rejects** raw Mac screenshots. They must be exactly **1280×800** or **640×400**, JPEG or **24-bit PNG (no alpha)**.

Drop raw captures in the repo root as `Screenshot-1.png`, `Screenshot-2.png`, etc., then run:

```bash
npm run store-assets
```

Upload the files from `docs/store-screenshots/`:

| File | Use in dashboard |
|------|------------------|
| `01-screenshot.png` … `05-screenshot.png` | Screenshots |
| `promo-small-440x280.png` | Small promo tile (optional) |
| `promo-marquee-1400x560.png` | Marquee promo tile (optional) |

Capture ideas:

1. YouTube homepage with text-only cards (extension on)
2. Transcript article view after clicking a title
3. Extension popup with toggle visible
4. Search results or subscriptions page in text-only mode

## Upload package

```bash
npm run package
# upload dist/quit-youtube-vX.Y.Z.zip in the developer dashboard
```
