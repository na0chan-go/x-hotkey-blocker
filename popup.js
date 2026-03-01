const STORAGE_KEY_ENABLED = "enabled";
const STORAGE_KEY_REQUIRE_CONFIRM = "requireConfirm";

const enabledToggleEl = document.getElementById("enabled-toggle");
const confirmToggleEl = document.getElementById("confirm-toggle");
const statusEl = document.getElementById("status-text");

function renderStatus(enabled, requireConfirm) {
  const enabledText = enabled ? "ON" : "OFF";
  const confirmText = requireConfirm ? "ON" : "OFF";
  statusEl.textContent = `現在: 機能 ${enabledText} / 二段階確認 ${confirmText}`;
}

async function init() {
  const data = await chrome.storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_REQUIRE_CONFIRM]);

  const enabled = typeof data[STORAGE_KEY_ENABLED] === "boolean" ? data[STORAGE_KEY_ENABLED] : true;
  const requireConfirm =
    typeof data[STORAGE_KEY_REQUIRE_CONFIRM] === "boolean" ? data[STORAGE_KEY_REQUIRE_CONFIRM] : true;

  enabledToggleEl.checked = enabled;
  confirmToggleEl.checked = requireConfirm;
  renderStatus(enabled, requireConfirm);

  const initialValues = {};
  if (typeof data[STORAGE_KEY_ENABLED] !== "boolean") initialValues[STORAGE_KEY_ENABLED] = true;
  if (typeof data[STORAGE_KEY_REQUIRE_CONFIRM] !== "boolean") {
    initialValues[STORAGE_KEY_REQUIRE_CONFIRM] = true;
  }
  if (Object.keys(initialValues).length > 0) {
    await chrome.storage.local.set(initialValues);
  }
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

void init();
