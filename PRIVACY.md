# Privacy Policy — Quit YouTube

**Last updated:** July 1, 2026

Quit YouTube does not collect, sell, or share your personal data.

## What the extension stores

The extension saves one preference on your device using Chrome's `storage` API:

- **Text-only mode on/off** — synced via `chrome.storage.sync` if you use Chrome sync
- **Google AI API key (optional, for TLDR)** — stored locally in `chrome.storage.local` on your device only; not synced

This preference stays in your browser. We do not operate servers and do not receive this data.

## TLDR summarization

If you use TLDR, the extension sends the open video transcript and your API key directly to Google's Generative Language API (`generativelanguage.googleapis.com`) to generate a summary. We do not proxy or store transcript or summary data on our servers.

## What the extension accesses

Quit YouTube runs only on `https://www.youtube.com/*`. It reads the YouTube page to:

- Replace video thumbnails with text cards
- Fetch and display video transcripts when you open a title

It does not read passwords, payment information, or browsing activity on other sites.

## Third parties

Quit YouTube does not use analytics, ads, or third-party trackers.

## Contact

Questions or requests: [open an issue](https://github.com/AdamGonda/attention-shield/issues) on GitHub.
