# Release checklist

## One-time setup

1. [Register as a Chrome Web Store developer](https://chrome.google.com/webstore/devconsole) ($5 one-time fee)
2. Create a new store item and keep the listing draft open
3. Copy text from [STORE_LISTING.md](./STORE_LISTING.md) into the dashboard
4. Set privacy policy URL to:
   `https://github.com/AdamGonda/attention-shield/blob/main/PRIVACY.md`

## Every release

```bash
# 1. Bump version in manifest.json
npm run version:patch   # or version:minor / version:major

# 2. Validate and build the upload ZIP
npm run package
# -> dist/quit-youtube-vX.Y.Z.zip

# 2b. Prepare store screenshots (if you added new raw captures)
npm run store-assets
# -> docs/store-screenshots/*.png (1280x800, no alpha)

# 3. Smoke-test locally
#    chrome://extensions → Load unpacked → refresh YouTube

# 4. Upload ZIP in Chrome Web Store dashboard → Submit for review

# 5. Tag the release (optional; triggers GitHub Release with ZIP attached)
git add manifest.json
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```

## Commands

| Command | What it does |
|---------|----------------|
| `npm run validate` | Check required files and manifest version |
| `npm run package` | Validate + create `dist/quit-youtube-vX.Y.Z.zip` |
| `npm run store-assets` | Convert raw screenshots to Chrome Web Store sizes |
| `npm run version:patch` | 1.1.0 → 1.1.1 |
| `npm run version:minor` | 1.1.0 → 1.2.0 |
| `npm run version:major` | 1.1.0 → 2.0.0 |

## After approval

- Switch listing from **Unlisted** to **Public** when ready
- Share the store URL
- For bug fixes: bump version, `npm run package`, upload new ZIP
