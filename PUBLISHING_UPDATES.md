# Updating Chat Carryover After Public Release

Yes, you can change the extension after it is public.

## How Updates Work

1. Edit the extension files.
2. Increment the `version` in `manifest.json`.
3. Create a new zip package.
4. Open the Chrome Web Store Developer Dashboard.
5. Select the existing extension item.
6. Upload the new package.
7. Submit the update for review.

After approval, Chrome automatically updates installed copies for users.

## Version Examples

- First public release: `1.0.0`
- Small bug fix: `1.0.1`
- New feature: `1.1.0`
- Bigger redesign: `2.0.0`

## Watch Out For

- New or broader permissions can make the review slower.
- Some permission changes may require users to accept the new permissions.
- Changing the extension's purpose can cause rejection. Keep it focused on conversation carryover.
- Update the privacy policy if data handling changes.
