# Quit YouTube

**Take back your attention.** YouTube without thumbnails—read any video's transcript like an article.

## Features

- Hides video thumbnails on homepage, search, subscriptions, and channel video tabs
- Shows channel profile picture, title, creator, views, and duration
- Click a title to read the video transcript as an article (no autoplay)
- Hides Shorts shelves
- Handles infinite scroll and YouTube SPA navigation
- Toggle on/off via the extension popup

## Install (Load Unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (`quit-youtube`)
5. Open [youtube.com](https://www.youtube.com) — the feed should transform automatically

## Usage

- Click the Quit YouTube icon in the toolbar to toggle text-only mode on or off
- Click a **title** to open the transcript as a readable article (stays on the feed)
- Click **Close** or press Escape to return to the compact card
- Click the **channel avatar** to open the channel page

## Project Structure

```
quit-youtube/
├── manifest.json
├── popup/           # Enable/disable toggle
├── content/         # Content scripts (extraction, transform, observer)
├── styles/          # Text-only card layout CSS
└── icons/           # icon.svg source + 16/48/128 PNGs
```

## Development

After editing files, reload the extension on `chrome://extensions` and refresh YouTube.

YouTube's DOM changes frequently. If cards stop transforming, update selectors in `content/extractors.js`.

## Permissions

- `storage` — saves the on/off toggle preference

No data is collected or sent anywhere.
