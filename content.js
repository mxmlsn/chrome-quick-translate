const BUTTON_ID = "quick-translate-floating-button";
const PANEL_ID = "quick-translate-panel";
const STYLE_ID = "quick-translate-style";
const SELECTION_MIN_LENGTH = 1;
const BUTTON_SIZE = 24;
const PANEL_MIN_WIDTH = 180;

let selectedText = "";
let selectedRect = null;
let hideButtonTimer = null;
let suppressButtonUntil = 0;
let lastMouseUpPoint = null;
let selectedTheme = "light";
let selectedFontFamily = "sans";
let selectedFontSize = 15;

injectStyles();
chrome.storage.sync.get({ theme: "light", fontFamily: "sans", fontSize: 15 }, (settings) => {
  selectedTheme = settings.theme;
  selectedFontFamily = settings.fontFamily;
  selectedFontSize = settings.fontSize;
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.theme) {
    selectedTheme = changes.theme.newValue || "light";
  }

  if (areaName === "sync" && changes.fontFamily) {
    selectedFontFamily = changes.fontFamily.newValue || "sans";
  }

  if (areaName === "sync" && changes.fontSize) {
    selectedFontSize = changes.fontSize.newValue || 15;
  }
});
document.addEventListener("mouseup", handleMouseUpSelection);
document.addEventListener("keyup", handleSelectionChange);
document.addEventListener("scroll", removeButton, true);
document.addEventListener("mousedown", handleOutsideMouseDown, true);

function handleMouseUpSelection(event) {
  lastMouseUpPoint = {
    x: event.clientX,
    y: event.clientY,
  };

  handleSelectionChange();
}

function handleSelectionChange() {
  window.clearTimeout(hideButtonTimer);

  if (Date.now() < suppressButtonUntil) {
    removeButton();
    return;
  }

  hideButtonTimer = window.setTimeout(() => {
    if (Date.now() < suppressButtonUntil) {
      removeButton();
      return;
    }

    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";

    if (text.length < SELECTION_MIN_LENGTH || !selection.rangeCount) {
      removeButton();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = getSelectionRect(range);

    if (!rect) {
      removeButton();
      return;
    }

    selectedText = text;
    selectedRect = rect;
    showButton(lastMouseUpPoint || { x: rect.left, y: rect.bottom + 8 });
  }, 80);
}

function getSelectionRect(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);

  if (rects.length > 0) {
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  const rect = range.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function showButton(point) {
  removeButton();

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.dataset.theme = selectedTheme;
  button.type = "button";
  button.setAttribute("aria-label", "Translate selected text");
  button.textContent = "中";
  button.style.left = `${getClampedLeft(point.x, BUTTON_SIZE)}px`;
  button.style.top = `${getClampedTop(point.y, BUTTON_SIZE)}px`;
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", handleTranslateClick);

  document.documentElement.append(button);
}

async function handleTranslateClick(event) {
  event.preventDefault();
  event.stopPropagation();
  suppressButtonUntil = Date.now() + 800;
  window.clearTimeout(hideButtonTimer);
  removeButton();

  if (!selectedText || !selectedRect) {
    showPanel("No selected text found.", "error");
    return;
  }

  showPanel("Translating...", "loading");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE_SELECTION",
      text: selectedText,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Translation failed.");
    }

    showPanel(response.translation, "success");
  } catch (error) {
    showPanel(error.message || "Translation failed.", "error");
  }
}

function showPanel(message, kind) {
  removePanel();

  const rect = selectedRect || { left: 8, top: 8, bottom: 8 };
  const panelWidth = getPanelWidth(rect);
  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.dataset.kind = kind;
  panel.dataset.theme = selectedTheme;
  panel.setAttribute("aria-live", "polite");
  panel.style.left = `${getClampedLeft(rect.left, panelWidth)}px`;
  panel.style.top = `${Math.max(8, rect.top + window.scrollY)}px`;
  panel.style.width = `${panelWidth}px`;
  panel.style.fontFamily = getPanelFontFamily();
  panel.style.fontSize = `${selectedFontSize}px`;

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "quick-translate-drag-handle";
  dragHandle.setAttribute("aria-label", "Drag translation popup");
  dragHandle.textContent = "⠿";
  makePanelDraggable(panel, dragHandle);

  const body = document.createElement("p");
  body.textContent = message;

  panel.append(dragHandle, body);
  document.documentElement.append(panel);
}

function makePanelDraggable(panel, handle) {
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const startRect = panel.getBoundingClientRect();
    const offsetX = event.clientX - startRect.left;
    const offsetY = event.clientY - startRect.top;

    function handlePointerMove(moveEvent) {
      const maxLeft = window.scrollX + Math.max(8, window.innerWidth - startRect.width - 8);
      const maxTop = window.scrollY + Math.max(8, window.innerHeight - startRect.height - 8);
      const nextLeft = moveEvent.clientX - offsetX + window.scrollX;
      const nextTop = moveEvent.clientY - offsetY + window.scrollY;

      panel.style.left = `${Math.min(maxLeft, Math.max(window.scrollX + 8, nextLeft))}px`;
      panel.style.top = `${Math.min(maxTop, Math.max(window.scrollY + 8, nextTop))}px`;
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  });
}

function getClampedLeft(viewportLeft, elementWidth) {
  const minLeft = window.scrollX + 8;
  const maxLeft = window.scrollX + Math.max(8, window.innerWidth - elementWidth - 8);

  return Math.min(maxLeft, Math.max(minLeft, viewportLeft + window.scrollX));
}

function getClampedTop(viewportTop, elementHeight) {
  const minTop = window.scrollY + 8;
  const maxTop = window.scrollY + Math.max(8, window.innerHeight - elementHeight - 8);

  return Math.min(maxTop, Math.max(minTop, viewportTop + window.scrollY));
}

function getPanelWidth(rect) {
  const maxWidth = Math.max(PANEL_MIN_WIDTH, window.innerWidth - 16);
  const selectionWidth = Number.isFinite(rect.width) ? rect.width : PANEL_MIN_WIDTH;

  return Math.round(Math.min(maxWidth, Math.max(PANEL_MIN_WIDTH, selectionWidth)));
}

function getPanelFontFamily() {
  if (selectedFontFamily === "times") {
    return "\"Times New Roman\", Times, serif";
  }

  if (selectedFontFamily === "georgia") {
    return "Georgia, \"Times New Roman\", Times, serif";
  }

  return "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
}

function handleOutsideMouseDown(event) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest(`#${BUTTON_ID}`) || target.closest(`#${PANEL_ID}`)) {
    return;
  }

  removeButton();
  removePanel();
}

function removeButton() {
  document.getElementById(BUTTON_ID)?.remove();
}

function removePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID} {
      position: absolute;
      z-index: 2147483646;
      display: inline-grid;
      place-items: center;
      width: ${BUTTON_SIZE}px;
      height: ${BUTTON_SIZE}px;
      border: 0;
      border-radius: 7px;
      padding: 0;
      color: var(--quick-translate-button-text, #ffffff);
      background: var(--quick-translate-button-bg, #2563eb);
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      font: 700 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
    }

    #${BUTTON_ID}:hover {
      background: var(--quick-translate-button-hover-bg, #1d4ed8);
    }

    #${BUTTON_ID}[data-theme="paper"] {
      --quick-translate-button-bg: #0f766e;
      --quick-translate-button-hover-bg: #0f5f59;
    }

    #${BUTTON_ID}[data-theme="mint"] {
      --quick-translate-button-bg: #15803d;
      --quick-translate-button-hover-bg: #166534;
    }

    #${BUTTON_ID}[data-theme="sky"] {
      --quick-translate-button-bg: #0369a1;
      --quick-translate-button-hover-bg: #075985;
    }

    #${BUTTON_ID}[data-theme="dark"] {
      --quick-translate-button-text: #111827;
      --quick-translate-button-bg: #60a5fa;
      --quick-translate-button-hover-bg: #3b82f6;
    }

    #${BUTTON_ID}[data-theme="graphite"] {
      --quick-translate-button-text: #18181b;
      --quick-translate-button-bg: #d4d4d8;
      --quick-translate-button-hover-bg: #a1a1aa;
    }

    #${BUTTON_ID}[data-theme="midnight"] {
      --quick-translate-button-text: #082f49;
      --quick-translate-button-bg: #38bdf8;
      --quick-translate-button-hover-bg: #7dd3fc;
    }

    #${BUTTON_ID}[data-theme="berry"] {
      --quick-translate-button-text: #3b0764;
      --quick-translate-button-bg: #f0abfc;
      --quick-translate-button-hover-bg: #f5d0fe;
    }

    #${BUTTON_ID}:focus-visible,
    #${PANEL_ID} button:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }

    #${PANEL_ID} {
      position: absolute;
      z-index: 2147483646;
      max-width: calc(100vw - 16px);
      border: 1px solid var(--quick-translate-border, rgb(229 231 235 / 0.65));
      border-radius: 14px;
      padding: 12px;
      color: var(--quick-translate-text, #111827);
      background: var(--quick-translate-bg, #ffffff);
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      font: 15px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #${PANEL_ID}[data-kind="error"] {
      border-color: #fecaca;
    }

    #${PANEL_ID}[data-theme="paper"] {
      --quick-translate-bg: #fafaf9;
      --quick-translate-text: #1c1917;
      --quick-translate-border: rgb(214 211 209 / 0.75);
      --quick-translate-handle-bg: #f5f5f4;
      --quick-translate-handle-text: #57534e;
    }

    #${PANEL_ID}[data-theme="mint"] {
      --quick-translate-bg: #f0fdf4;
      --quick-translate-text: #052e16;
      --quick-translate-border: rgb(187 247 208 / 0.8);
      --quick-translate-handle-bg: #dcfce7;
      --quick-translate-handle-text: #166534;
    }

    #${PANEL_ID}[data-theme="sky"] {
      --quick-translate-bg: #f0f9ff;
      --quick-translate-text: #082f49;
      --quick-translate-border: rgb(186 230 253 / 0.85);
      --quick-translate-handle-bg: #e0f2fe;
      --quick-translate-handle-text: #075985;
    }

    #${PANEL_ID}[data-theme="dark"] {
      --quick-translate-bg: #111827;
      --quick-translate-text: #f9fafb;
      --quick-translate-border: rgb(75 85 99 / 0.8);
      --quick-translate-handle-bg: #1f2937;
      --quick-translate-handle-text: #d1d5db;
    }

    #${PANEL_ID}[data-theme="graphite"] {
      --quick-translate-bg: #18181b;
      --quick-translate-text: #fafafa;
      --quick-translate-border: rgb(82 82 91 / 0.8);
      --quick-translate-handle-bg: #27272a;
      --quick-translate-handle-text: #d4d4d8;
    }

    #${PANEL_ID}[data-theme="midnight"] {
      --quick-translate-bg: #0f172a;
      --quick-translate-text: #e0f2fe;
      --quick-translate-border: rgb(51 65 85 / 0.9);
      --quick-translate-handle-bg: #1e293b;
      --quick-translate-handle-text: #bae6fd;
    }

    #${PANEL_ID}[data-theme="berry"] {
      --quick-translate-bg: #2e1065;
      --quick-translate-text: #faf5ff;
      --quick-translate-border: rgb(107 33 168 / 0.9);
      --quick-translate-handle-bg: #3b0764;
      --quick-translate-handle-text: #e9d5ff;
    }

    #${PANEL_ID} .quick-translate-drag-handle {
      position: absolute;
      top: 8px;
      right: 8px;
      display: inline-grid;
      place-items: center;
      width: 20px;
      height: 20px;
      border: 0;
      border-radius: 6px;
      padding: 0;
      color: var(--quick-translate-handle-text, #6b7280);
      background: var(--quick-translate-handle-bg, #f3f4f6);
      font: 700 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: grab;
      opacity: 0;
      pointer-events: none;
    }

    #${PANEL_ID}:hover .quick-translate-drag-handle,
    #${PANEL_ID}:focus-within .quick-translate-drag-handle {
      opacity: 1;
      pointer-events: auto;
    }

    #${PANEL_ID} .quick-translate-drag-handle:active {
      cursor: grabbing;
    }

    #${PANEL_ID} p {
      margin: 0;
      color: var(--quick-translate-text, #111827);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
  `;

  document.documentElement.append(style);
}
