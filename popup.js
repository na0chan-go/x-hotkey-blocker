const STORAGE_KEY_ENABLED = "enabled";
const STORAGE_KEY_REQUIRE_CONFIRM = "requireConfirm";
const STORAGE_KEY_HISTORY = "executionHistory";
const STORAGE_KEY_TRIGGER_MODIFIER = "triggerModifier";
const STORAGE_KEY_TRIGGER_MOUSE_BUTTON = "triggerMouseButton";
const HISTORY_SHOW_COUNT = 10;

const enabledToggleEl = document.getElementById("enabled-toggle");
const confirmToggleEl = document.getElementById("confirm-toggle");
const modifierSelectEl = document.getElementById("modifier-select");
const mouseButtonSelectEl = document.getElementById("mouse-button-select");
const statusEl = document.getElementById("status-text");
const historyListEl = document.getElementById("history-list");

const allowedModifiers = ["meta", "ctrl", "alt", "shift", "none"];
const allowedMouseButtons = ["left", "middle", "right"];

function normalizeModifier(value) {
  return allowedModifiers.includes(value) ? value : "ctrl";
}

function normalizeMouseButton(value) {
  return allowedMouseButtons.includes(value) ? value : "left";
}

function modifierLabel(value) {
  if (value === "meta") return "Cmd/Meta";
  if (value === "ctrl") return "Ctrl";
  if (value === "alt") return "Alt";
  if (value === "shift") return "Shift";
  return "なし";
}

function mouseButtonLabel(value) {
  if (value === "left") return "左";
  if (value === "middle") return "中";
  return "右";
}

function renderStatus(enabled, requireConfirm, modifier, mouseButton) {
  const enabledText = enabled ? "ON" : "OFF";
  const confirmText = requireConfirm ? "ON" : "OFF";
  statusEl.textContent = `現在: 機能 ${enabledText} / 二段階確認 ${confirmText} / トリガー ${modifierLabel(modifier)} + ${mouseButtonLabel(mouseButton)}クリック`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHistory(items) {
  if (!Array.isArray(items) || items.length === 0) {
    historyListEl.innerHTML = '<li class="history-item">まだ履歴がありません</li>';
    return;
  }

  const rows = items.slice(0, HISTORY_SHOW_COUNT).map((item) => {
    const label = escapeHtml(item.label || "不明");
    const target = escapeHtml(item.screenName || "unknown");
    const time = formatTime(item.timestamp || Date.now());

    return [
      '<li class="history-item">',
      '<div class="history-line1">',
      `<span class="history-label">${label}</span>`,
      `<span class="history-time">${time}</span>`,
      "</div>",
      `<div class="history-target">対象: ${target}</div>`,
      "</li>"
    ].join("");
  });

  historyListEl.innerHTML = rows.join("");
}

function currentSettingsFromUI() {
  return {
    enabled: enabledToggleEl.checked,
    requireConfirm: confirmToggleEl.checked,
    modifier: normalizeModifier(modifierSelectEl.value),
    mouseButton: normalizeMouseButton(mouseButtonSelectEl.value)
  };
}

function renderAllStatusFromUI() {
  const state = currentSettingsFromUI();
  renderStatus(state.enabled, state.requireConfirm, state.modifier, state.mouseButton);
}

async function loadAll() {
  const data = await chrome.storage.local.get([
    STORAGE_KEY_ENABLED,
    STORAGE_KEY_REQUIRE_CONFIRM,
    STORAGE_KEY_TRIGGER_MODIFIER,
    STORAGE_KEY_TRIGGER_MOUSE_BUTTON,
    STORAGE_KEY_HISTORY
  ]);

  const enabled = typeof data[STORAGE_KEY_ENABLED] === "boolean" ? data[STORAGE_KEY_ENABLED] : true;
  const requireConfirm =
    typeof data[STORAGE_KEY_REQUIRE_CONFIRM] === "boolean" ? data[STORAGE_KEY_REQUIRE_CONFIRM] : true;
  const modifier = normalizeModifier(data[STORAGE_KEY_TRIGGER_MODIFIER]);
  const mouseButton = normalizeMouseButton(data[STORAGE_KEY_TRIGGER_MOUSE_BUTTON]);
  const history = Array.isArray(data[STORAGE_KEY_HISTORY]) ? data[STORAGE_KEY_HISTORY] : [];

  enabledToggleEl.checked = enabled;
  confirmToggleEl.checked = requireConfirm;
  modifierSelectEl.value = modifier;
  mouseButtonSelectEl.value = mouseButton;
  renderStatus(enabled, requireConfirm, modifier, mouseButton);
  renderHistory(history);

  const initialValues = {};
  if (typeof data[STORAGE_KEY_ENABLED] !== "boolean") initialValues[STORAGE_KEY_ENABLED] = true;
  if (typeof data[STORAGE_KEY_REQUIRE_CONFIRM] !== "boolean") {
    initialValues[STORAGE_KEY_REQUIRE_CONFIRM] = true;
  }
  if (modifier !== data[STORAGE_KEY_TRIGGER_MODIFIER]) {
    initialValues[STORAGE_KEY_TRIGGER_MODIFIER] = modifier;
  }
  if (mouseButton !== data[STORAGE_KEY_TRIGGER_MOUSE_BUTTON]) {
    initialValues[STORAGE_KEY_TRIGGER_MOUSE_BUTTON] = mouseButton;
  }
  if (!Array.isArray(data[STORAGE_KEY_HISTORY])) {
    initialValues[STORAGE_KEY_HISTORY] = [];
  }
  if (Object.keys(initialValues).length > 0) {
    await chrome.storage.local.set(initialValues);
  }
}

function watchStorage() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes[STORAGE_KEY_ENABLED]) enabledToggleEl.checked = Boolean(changes[STORAGE_KEY_ENABLED].newValue);
    if (changes[STORAGE_KEY_REQUIRE_CONFIRM]) {
      confirmToggleEl.checked = Boolean(changes[STORAGE_KEY_REQUIRE_CONFIRM].newValue);
    }
    if (changes[STORAGE_KEY_TRIGGER_MODIFIER]) {
      modifierSelectEl.value = normalizeModifier(changes[STORAGE_KEY_TRIGGER_MODIFIER].newValue);
    }
    if (changes[STORAGE_KEY_TRIGGER_MOUSE_BUTTON]) {
      mouseButtonSelectEl.value = normalizeMouseButton(changes[STORAGE_KEY_TRIGGER_MOUSE_BUTTON].newValue);
    }

    renderAllStatusFromUI();

    if (changes[STORAGE_KEY_HISTORY]) {
      const history = Array.isArray(changes[STORAGE_KEY_HISTORY].newValue) ? changes[STORAGE_KEY_HISTORY].newValue : [];
      renderHistory(history);
    }
  });
}

enabledToggleEl.addEventListener("change", async () => {
  await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: enabledToggleEl.checked });
  renderAllStatusFromUI();
});

confirmToggleEl.addEventListener("change", async () => {
  await chrome.storage.local.set({ [STORAGE_KEY_REQUIRE_CONFIRM]: confirmToggleEl.checked });
  renderAllStatusFromUI();
});

modifierSelectEl.addEventListener("change", async () => {
  const modifier = normalizeModifier(modifierSelectEl.value);
  modifierSelectEl.value = modifier;
  await chrome.storage.local.set({ [STORAGE_KEY_TRIGGER_MODIFIER]: modifier });
  renderAllStatusFromUI();
});

mouseButtonSelectEl.addEventListener("change", async () => {
  const mouseButton = normalizeMouseButton(mouseButtonSelectEl.value);
  mouseButtonSelectEl.value = mouseButton;
  await chrome.storage.local.set({ [STORAGE_KEY_TRIGGER_MOUSE_BUTTON]: mouseButton });
  renderAllStatusFromUI();
});

void loadAll();
watchStorage();
