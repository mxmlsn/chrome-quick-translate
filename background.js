const DEEPL_FREE_ENDPOINT = "https://api-free.deepl.com/v2/translate";
const DEEPL_PRO_ENDPOINT = "https://api.deepl.com/v2/translate";
const DEFAULT_TARGET_LANG = "RU";
const ACTION_ICON_COLOR = [37, 99, 235, 255];
const ACTION_ICON_TEXT_COLOR = [255, 255, 255, 255];
const ACTION_ICON_PATTERN = [
  "00100",
  "00100",
  "11111",
  "10101",
  "10101",
  "11111",
  "00100",
  "00100",
];

setActionIcon();
chrome.runtime.onInstalled.addListener(setActionIcon);
chrome.runtime.onStartup.addListener(setActionIcon);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TRANSLATE_SELECTION") {
    translateText(message.text)
      .then((translation) => sendResponse({ ok: true, translation }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "TEST_DEEPL_KEY") {
    translateText("Hello", {
      deeplApiKey: message.deeplApiKey,
      targetLang: message.targetLang,
    })
      .then((translation) => sendResponse({ ok: true, translation }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  return false;
});

function setActionIcon() {
  chrome.action.setIcon({
    imageData: {
      16: createActionIconImageData(16),
      32: createActionIconImageData(32),
      48: createActionIconImageData(48),
      128: createActionIconImageData(128),
    },
  });
}

function createActionIconImageData(size) {
  const data = new Uint8ClampedArray(size * size * 4);
  const radius = Math.max(3, Math.round(size * 0.22));
  const scale = Math.max(1, Math.floor(size / 10));
  const glyphWidth = ACTION_ICON_PATTERN[0].length * scale;
  const glyphHeight = ACTION_ICON_PATTERN.length * scale;
  const glyphLeft = Math.floor((size - glyphWidth) / 2);
  const glyphTop = Math.floor((size - glyphHeight) / 2);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isInsideRoundedSquare(x, y, size, radius)) {
        setPixel(data, size, x, y, ACTION_ICON_COLOR);
      }
    }
  }

  ACTION_ICON_PATTERN.forEach((row, rowIndex) => {
    Array.from(row).forEach((cell, columnIndex) => {
      if (cell !== "1") {
        return;
      }

      fillRect(
        data,
        size,
        glyphLeft + columnIndex * scale,
        glyphTop + rowIndex * scale,
        scale,
        scale,
        ACTION_ICON_TEXT_COLOR,
      );
    });
  });

  return new ImageData(data, size, size);
}

function isInsideRoundedSquare(x, y, size, radius) {
  const centerX = Math.min(Math.max(x, radius), size - 1 - radius);
  const centerY = Math.min(Math.max(y, radius), size - 1 - radius);

  return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
}

function fillRect(data, imageSize, left, top, width, height, color) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      if (x >= 0 && x < imageSize && y >= 0 && y < imageSize) {
        setPixel(data, imageSize, x, y, color);
      }
    }
  }
}

function setPixel(data, imageSize, x, y, color) {
  const index = (y * imageSize + x) * 4;

  data[index] = color[0];
  data[index + 1] = color[1];
  data[index + 2] = color[2];
  data[index + 3] = color[3];
}

async function translateText(text, settingsOverride) {
  const cleanText = typeof text === "string" ? text.trim() : "";

  if (!cleanText) {
    throw new Error("Select text to translate.");
  }

  const { deeplApiKey, targetLang } = settingsOverride || await chrome.storage.sync.get({
    deeplApiKey: "",
    targetLang: DEFAULT_TARGET_LANG,
  });

  if (!deeplApiKey) {
    throw new Error("Add your DeepL API key in the extension popup.");
  }

  const endpoint = getDeepLEndpoint(deeplApiKey);
  const body = new URLSearchParams({
    text: cleanText,
    target_lang: targetLang || DEFAULT_TARGET_LANG,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${deeplApiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(getDeepLErrorMessage(response.status, errorText, endpoint));
  }

  const data = await response.json();
  const translation = data?.translations?.[0]?.text;

  if (!translation) {
    throw new Error("DeepL returned an empty translation.");
  }

  return translation;
}

function getDeepLEndpoint(deeplApiKey) {
  return deeplApiKey.endsWith(":fx") ? DEEPL_FREE_ENDPOINT : DEEPL_PRO_ENDPOINT;
}

function getDeepLErrorMessage(status, errorText, endpoint) {
  if (status === 403) {
    return `DeepL rejected the API key. Endpoint: ${endpoint}. Response: ${errorText}`;
  }

  if (status === 456) {
    return "DeepL quota exceeded for this API key.";
  }

  if (status === 429) {
    return "Too many translation requests. Try again later.";
  }

  return `DeepL request failed (${status}). Endpoint: ${endpoint}. Response: ${errorText}`.trim();
}
