const STORAGE_KEY_ENABLED = "enabled";
const STORAGE_KEY_REQUIRE_CONFIRM = "requireConfirm";
const STORAGE_KEY_HISTORY = "executionHistory";
const HISTORY_SHOW_COUNT = 10;

const enabledToggleEl = document.getElementById("enabled-toggle");
const confirmToggleEl = document.getElementById("confirm-toggle");
const statusEl = document.getElementById("status-text");
const historyListEl = document.getElementById("history-list");

function renderStatus(enabled, requireConfirm) {
  const enabledText = enabled ? "ON" : "OFF";
  const confirmText = requireConfirm ? "ON" : "OFF";
  statusEl.textContent = `現在: 機能 ${enabledText} / 二段階確認 ${confirmText}`;
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

async function loadAll() {
  const data = await chrome.storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_REQUIRE_CONFIRM, STORAGE_KEY_HISTORY]);

  const enabled = typeof data[STORAGE_KEY_ENABLED] === "boolean" ? data[STORAGE_KEY_ENABLED] : true;
  const requireConfirm =
    typeof data[STORAGE_KEY_REQUIRE_CONFIRM] === "boolean" ? data[STORAGE_KEY_REQUIRE_CONFIRM] : true;
  const history = Array.isArray(data[STORAGE_KEY_HISTORY]) ? data[STORAGE_KEY_HISTORY] : [];

  enabledToggleEl.checked = enabled;
  confirmToggleEl.checked = requireConfirm;
  renderStatus(enabled, requireConfirm);
  renderHistory(history);

  const initialValues = {};
  if (typeof data[STORAGE_KEY_ENABLED] !== "boolean") initialValues[STORAGE_KEY_ENABLED] = true;
  if (typeof data[STORAGE_KEY_REQUIRE_CONFIRM] !== "boolean") {
    initialValues[STORAGE_KEY_REQUIRE_CONFIRM] = true;
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

    const enabled = changes[STORAGE_KEY_ENABLED] ? Boolean(changes[STORAGE_KEY_ENABLED].newValue) : enabledToggleEl.checked;
    const requireConfirm = changes[STORAGE_KEY_REQUIRE_CONFIRM]
      ? Boolean(changes[STORAGE_KEY_REQUIRE_CONFIRM].newValue)
      : confirmToggleEl.checked;

    if (changes[STORAGE_KEY_ENABLED]) enabledToggleEl.checked = enabled;
    if (changes[STORAGE_KEY_REQUIRE_CONFIRM]) confirmToggleEl.checked = requireConfirm;
    renderStatus(enabled, requireConfirm);

    if (changes[STORAGE_KEY_HISTORY]) {
      const history = Array.isArray(changes[STORAGE_KEY_HISTORY].newValue) ? changes[STORAGE_KEY_HISTORY].newValue : [];
      renderHistory(history);
    }
  });
}

enabledToggleEl.addEventListener("change", async () => {
  const enabled = enabledToggleEl.checked;
  const requireConfirm = confirmToggleEl.checked;
  await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: enabled });
  renderStatus(enabled, requireConfirm);
});

confirmToggleEl.addEventListener("change", async () => {
  const enabled = enabledToggleEl.checked;
  const requireConfirm = confirmToggleEl.checked;
  await chrome.storage.local.set({ [STORAGE_KEY_REQUIRE_CONFIRM]: requireConfirm });
  renderStatus(enabled, requireConfirm);
});

void loadAll();
watchStorage();
