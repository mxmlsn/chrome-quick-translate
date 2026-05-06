const apiKeyInput = document.querySelector("#deepl-api-key");
const targetLangSelect = document.querySelector("#target-lang");
const themeSelect = document.querySelector("#theme");
const fontFamilySelect = document.querySelector("#font-family");
const decreaseFontSizeButton = document.querySelector("#decrease-font-size");
const increaseFontSizeButton = document.querySelector("#increase-font-size");
const fontSizeValue = document.querySelector("#font-size-value");
const settingsForm = document.querySelector("#settings-form");
const statusElement = document.querySelector("#status");
const testKeyButton = document.querySelector("#test-key");

chrome.storage.sync.get(
  { deeplApiKey: "", targetLang: "RU", theme: "light", fontFamily: "sans", fontSize: 15 },
  (settings) => {
  apiKeyInput.value = settings.deeplApiKey;
  targetLangSelect.value = settings.targetLang;
  themeSelect.value = settings.theme;
  fontFamilySelect.value = settings.fontFamily;
  updateFontSizeValue(settings.fontSize);
  applyTheme(settings.theme);
  }
);

themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;

  applyTheme(theme);
  chrome.storage.sync.set({ theme });
});

fontFamilySelect.addEventListener("change", () => {
  chrome.storage.sync.set({ fontFamily: fontFamilySelect.value });
});

decreaseFontSizeButton.addEventListener("click", () => {
  changeFontSize(-1);
});

increaseFontSizeButton.addEventListener("click", () => {
  changeFontSize(1);
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const deeplApiKey = apiKeyInput.value.trim();
  const targetLang = targetLangSelect.value;
  const theme = themeSelect.value;
  const fontFamily = fontFamilySelect.value;
  const fontSize = getCurrentFontSize();

  const validationError = getApiKeyValidationError(deeplApiKey);

  if (validationError) {
    showStatus(validationError, "error");
    return;
  }

  chrome.storage.sync.set({ deeplApiKey, targetLang, theme, fontFamily, fontSize }, () => {
    showStatus("Settings saved.", "success");
  });
});

testKeyButton.addEventListener("click", async () => {
  const deeplApiKey = apiKeyInput.value.trim();
  const targetLang = targetLangSelect.value;
  const validationError = getApiKeyValidationError(deeplApiKey);

  if (validationError) {
    showStatus(validationError, "error");
    return;
  }

  testKeyButton.disabled = true;
  showStatus("Testing key...", "success");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TEST_DEEPL_KEY",
      deeplApiKey,
      targetLang,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Key test failed.");
    }

    showStatus(`Key works. Test translation: ${response.translation}`, "success");
  } catch (error) {
    showStatus(error.message || "Key test failed.", "error");
  } finally {
    testKeyButton.disabled = false;
  }
});

function showStatus(message, kind) {
  statusElement.textContent = message;
  statusElement.dataset.kind = kind;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || "light";
}

function changeFontSize(delta) {
  const fontSize = Math.min(24, Math.max(12, getCurrentFontSize() + delta));

  updateFontSizeValue(fontSize);
  chrome.storage.sync.set({ fontSize });
}

function getCurrentFontSize() {
  return Number.parseInt(fontSizeValue.dataset.value || "15", 10);
}

function updateFontSizeValue(fontSize) {
  fontSizeValue.dataset.value = String(fontSize);
  fontSizeValue.textContent = `${fontSize}px`;
}

function getApiKeyValidationError(deeplApiKey) {
  if (!deeplApiKey) {
    return "Enter your DeepL API key.";
  }

  if (deeplApiKey.includes("*")) {
    return "This looks like a masked key. Use the copy button in DeepL to copy the full key.";
  }

  return "";
}
