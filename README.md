# Quit YouTube

A Chrome extension that turns YouTube into a text-first reading surface.

Thumbnails, autoplay, and Shorts are built to pull you in. This extension hides them. You see titles, channels, views, and duration. Click a title to read the transcript like an article — no video playing.

## What it does

- Replaces thumbnails with compact text cards on Home, Search, Subscriptions, and channel video tabs
- Opens the video transcript inline when you click a title (no autoplay)
- Optionally summarizes an open transcript (TLDR) if you add a Google AI API key
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
- Click a **title** → read the transcript; **Close** or Escape returns to the card
- Click the **channel avatar** → open the channel
- Right-click the extension icon → set a Google AI API key if you want TLDR

Your on/off preference is stored in Chrome. The optional API key stays on this device. Nothing is sent to us. Transcripts go to Google only if you use TLDR. See [PRIVACY.md](./PRIVACY.md).

## Develop

YouTube’s DOM changes often. If cards stop transforming, update selectors in `content/extractors.js`. Reload the extension, then refresh YouTube.

```bash
npm run validate   # manifest + required files
npm run package    # dist/quit-youtube-vX.Y.Z.zip
```

Chrome Web Store steps: [RELEASE.md](./RELEASE.md). Listing copy: [STORE_LISTING.md](./STORE_LISTING.md).
