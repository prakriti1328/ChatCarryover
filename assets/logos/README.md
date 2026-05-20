# Chat Carryover Logo Pack

These are editable SVG logo concepts for the extension. Export the selected mark to PNG for Chrome Web Store upload.

## Concepts

- `carryover-bolt.svg` - energetic, simple, and strongest for small toolbar icons.
- `portal-bubbles.svg` - best for explaining "old chat to new chat" visually.
- `memory-spark.svg` - playful memory/context theme.
- `remix-ribbon.svg` - boldest and most experimental.

## Recommended Choice

Use `carryover-bolt.svg` as the main extension icon because it stays readable at tiny sizes.

## Chrome Icon Exports

Export the chosen SVG into:

- `icons/icon16.png`
- `icons/icon32.png`
- `icons/icon48.png`
- `icons/icon128.png`

Then add this back to `manifest.json`:

```json
"icons": {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
},
"action": {
  "default_title": "Chat Carryover",
  "default_popup": "popup.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```
