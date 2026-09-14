# Quit YouTube

A Chrome extension that turns YouTube into a text-first reading surface.

Thumbnails, autoplay, and Shorts are built to pull you in. This extension hides them. You see titles, channels, views, and duration. Click a title to get a TLDR of the video — no player, no transcript dump.

## What it does

- Replaces thumbnails with compact text cards on Home, Search, Subscriptions, and channel video tabs
- Opens a TLDR of the video when you click a title (fetches the transcript in the background, never plays the video)
- Hides Shorts shelves
- Follows infinite scroll and YouTube’s in-page navigation
- Turns on and off from the toolbar popup

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder
4. Open [youtube.com](https://www.youtube.com)

## Use

- Toolbar icon → toggle text-only mode
- Right-click the extension icon → set a Google AI API key (needed for TLDRs)
- Click a **title** → TLDR of that video; **Close** or Escape returns to the card
- Click the **channel avatar** → open the channel

Your on/off preference is stored in Chrome. The API key stays on this device. Nothing is sent to us. Opening a title sends that video’s transcript to Google to generate the summary. See [PRIVACY.md](./PRIVACY.md).

## Develop

YouTube’s DOM changes often. If cards stop transforming, update selectors in `content/extractors.js`. Reload the extension, then refresh YouTube.

```bash
npm run validate   # manifest + required files
npm run package    # dist/quit-youtube-vX.Y.Z.zip
```

Chrome Web Store steps: [RELEASE.md](./RELEASE.md). Listing copy: [STORE_LISTING.md](./STORE_LISTING.md).
