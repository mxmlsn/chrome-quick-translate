const apiKeyInput = document.querySelector("#deepl-api-key");
const targetLangSelect = document.querySelector("#target-lang");
const settingsForm = document.querySelector("#settings-form");
const statusElement = document.querySelector("#status");
const testKeyButton = document.querySelector("#test-key");

chrome.storage.sync.get({ deeplApiKey: "", targetLang: "RU" }, (settings) => {
  apiKeyInput.value = settings.deeplApiKey;
  targetLangSelect.value = settings.targetLang;
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const deeplApiKey = apiKeyInput.value.trim();
  const targetLang = targetLangSelect.value;

  const validationError = getApiKeyValidationError(deeplApiKey);

  if (validationError) {
    showStatus(validationError, "error");
    return;
  }

  chrome.storage.sync.set({ deeplApiKey, targetLang }, () => {
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

function getApiKeyValidationError(deeplApiKey) {
  if (!deeplApiKey) {
    return "Enter your DeepL API key.";
  }

  if (deeplApiKey.includes("*")) {
    return "This looks like a masked key. Use the copy button in DeepL to copy the full key.";
  }

  return "";
}
