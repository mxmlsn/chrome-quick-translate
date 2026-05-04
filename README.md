# Chrome Quick Translate

Simple Chrome extension for translating selected text with DeepL API Free.

## Features

- Translate selected text on any web page
- Floating translate button near the cursor
- Translation popup on the page
- Default target language: Russian
- DeepL API key stored in Chrome extension storage

## Installation

1. Clone this repository or download it as a ZIP archive.
2. Open Chrome and go to:

```text
chrome://extensions
```

3. Enable Developer mode.
4. Click Load unpacked.
5. Select the project folder.

## DeepL API key

This extension uses DeepL API Free.

1. Create a DeepL API Free account:

```text
https://www.deepl.com/pro-api
```

2. Open the extension popup.
3. Paste your DeepL API key.
4. Click Save settings.
5. Click Test key to verify that the key works.

Free DeepL API keys usually end with `:fx`.

## Usage

1. Select text on a web page.
2. A small blue translate button appears where you release the cursor.
3. Click the button.
4. The translation appears in a popup.
5. Click outside the popup to close it.
6. Use the small handle in the top-right corner to drag the popup.

## Security note

This MVP stores the DeepL API key directly in Chrome extension storage. This is acceptable for personal use, but not recommended for a public extension.

For public distribution, use a backend proxy such as Cloudflare Worker and keep the DeepL API key on the server.
