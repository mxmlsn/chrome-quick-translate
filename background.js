const DEEPL_FREE_ENDPOINT = "https://api-free.deepl.com/v2/translate";
const DEEPL_PRO_ENDPOINT = "https://api.deepl.com/v2/translate";
const DEFAULT_TARGET_LANG = "RU";

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
