# Chat Carryover

Chat Carryover is a Chrome extension concept and MVP for continuing long AI conversations after a chat credit/session limit is reached.

It opens a previous chat link, extracts the readable conversation from the page, creates a compact continuation brief, and inserts that brief into the active new chat composer.

## What It Does

- Works across many AI chat websites by reading visible page content instead of relying on private APIs.
- Accepts a previous chat URL, including public share links or logged-in chat links you can access.
- Produces a structured handoff brief with the user goal, decisions, current state, unresolved items, and snippets.
- Inserts the brief into the currently open AI chat input, or lets you copy it manually.
- Can include a compressed transcript appendix when more detail is needed.

## Important Limits

- It can only read chats that your browser can open.
- Some platforms render chat content lazily, block background tabs, or hide old messages until scrolled. For best results, open the old chat once, scroll through it, then use the extension.
- Private AI platform APIs are intentionally avoided so the extension remains platform-neutral.
- The MVP uses local heuristic summarization. That avoids spending additional AI credits just to summarize the chat.

## Local Deployment

1. Open Chrome and go to `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder:
5. Pin `Chat Carryover` from the extensions menu.

## How To Use

1. Open the new AI chat where you want to continue.
2. Click the Chat Carryover extension icon.
3. Paste the previous chat link.
4. Click `Compile previous chat`.
5. Review the continuation brief.
6. Click `Insert into current chat`, or click `Copy` and paste it manually.

## Publishing To Chrome Web Store

1. Create production icons as PNG files at 16, 32, 48, and 128 pixels.
2. Zip the extension folder contents, not the parent folder.
3. Create a Chrome Web Store Developer account.
4. Upload the zip as a new item.
5. Fill out the listing, privacy policy, screenshots, and permission justification.
6. Submit for review.

Because this extension requests access to chat pages, the store listing should clearly explain that page access is used only to extract the conversation text for the user-requested handoff brief.
