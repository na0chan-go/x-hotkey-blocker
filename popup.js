const STORAGE_KEY_ENABLED = "enabled";

const toggleEl = document.getElementById("enabled-toggle");
const statusEl = document.getElementById("status-text");

function renderStatus(enabled) {
  statusEl.textContent = enabled ? "現在: ON" : "現在: OFF";
}

async function init() {
  const data = await chrome.storage.local.get(STORAGE_KEY_ENABLED);
  const enabled = typeof data[STORAGE_KEY_ENABLED] === "boolean" ? data[STORAGE_KEY_ENABLED] : true;

  toggleEl.checked = enabled;
  renderStatus(enabled);

  if (typeof data[STORAGE_KEY_ENABLED] !== "boolean") {
    await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: true });
  }
}

toggleEl.addEventListener("change", async () => {
  const enabled = toggleEl.checked;
  await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: enabled });
  renderStatus(enabled);
});

void init();
