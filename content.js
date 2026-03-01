(() => {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const UNFOLLOW_MENU_PATTERNS = [/\bunfollow\b/i, /フォロー.*解除/];
  const CONFIRM_WINDOW_MS = 3000;
  const STORAGE_KEY_ENABLED = "enabled";
  const STORAGE_KEY_REQUIRE_CONFIRM = "requireConfirm";

  let extensionEnabled = true;
  let requireConfirm = true;
  let isProcessing = false;
  let pendingConfirm = null;
  let toastRoot = null;

  function hasHotkey(event) {
    return isMac ? event.metaKey : event.ctrlKey;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForElement(selector, timeoutMs = 4000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(100);
    }
    return null;
  }

  function findPostElement(target) {
    return target.closest('article[data-testid="tweet"]');
  }

  function findOpenMenuButton(postEl) {
    return postEl.querySelector('[data-testid="caret"]') || postEl.querySelector('button[aria-label="More"]');
  }

  function getMenuItems() {
    return Array.from(document.querySelectorAll('[role="menuitem"]'));
  }

  function isFollowingByMenuItems(items) {
    return items.some((item) => {
      const text = (item.textContent || "").replace(/\s+/g, " ").trim();
      return UNFOLLOW_MENU_PATTERNS.some((pattern) => pattern.test(text));
    });
  }

  function findBlockMenuItem(items) {
    return (
      items.find((item) => /block\s*@/i.test(item.textContent || "")) ||
      items.find((item) => /(ブロック|block)/i.test(item.textContent || ""))
    );
  }

  function closeMenu() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }

  function getPostKey(postEl) {
    const statusLink = postEl.querySelector('a[href*="/status/"]');
    if (!statusLink) return null;

    const href = statusLink.getAttribute("href") || "";
    const match = href.match(/\/status\/(\d+)/);
    if (match) return match[1];
    return href;
  }

  function ensureToastRoot() {
    if (toastRoot && document.body.contains(toastRoot)) return toastRoot;

    toastRoot = document.createElement("div");
    toastRoot.id = "xhb-toast-root";
    Object.assign(toastRoot.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "999999",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      pointerEvents: "none"
    });
    document.body.appendChild(toastRoot);
    return toastRoot;
  }

  function showToast(message, variant = "info") {
    const root = ensureToastRoot();
    const toast = document.createElement("div");

    const bgMap = {
      info: "#1f2937",
      success: "#14532d",
      warning: "#78350f",
      error: "#7f1d1d"
    };

    Object.assign(toast.style, {
      color: "#ffffff",
      background: bgMap[variant] || bgMap.info,
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: "8px",
      boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
      padding: "10px 12px",
      fontSize: "13px",
      maxWidth: "360px",
      pointerEvents: "none",
      opacity: "0",
      transform: "translateY(8px)",
      transition: "opacity 140ms ease, transform 140ms ease"
    });

    toast.textContent = message;
    root.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    void (async () => {
      await wait(2200);
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      await wait(180);
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    })();
  }

  function resetPendingConfirm() {
    pendingConfirm = null;
  }

  function needsSecondClick(postEl) {
    const now = Date.now();
    const postKey = getPostKey(postEl);

    if (!pendingConfirm || now > pendingConfirm.expiresAt) {
      pendingConfirm = {
        key: postKey,
        postEl,
        expiresAt: now + CONFIRM_WINDOW_MS
      };
      return true;
    }

    const isSameByKey = postKey && pendingConfirm.key && postKey === pendingConfirm.key;
    const isSameByRef = !postKey && pendingConfirm.key === null && pendingConfirm.postEl === postEl;
    if (isSameByKey || isSameByRef) {
      resetPendingConfirm();
      return false;
    }

    pendingConfirm = {
      key: postKey,
      postEl,
      expiresAt: now + CONFIRM_WINDOW_MS
    };
    return true;
  }

  async function loadSettings() {
    if (!chrome?.storage?.local) return;

    const data = await chrome.storage.local.get([STORAGE_KEY_ENABLED, STORAGE_KEY_REQUIRE_CONFIRM]);

    if (typeof data[STORAGE_KEY_ENABLED] === "boolean") {
      extensionEnabled = data[STORAGE_KEY_ENABLED];
    } else {
      extensionEnabled = true;
      await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: true });
    }

    if (typeof data[STORAGE_KEY_REQUIRE_CONFIRM] === "boolean") {
      requireConfirm = data[STORAGE_KEY_REQUIRE_CONFIRM];
    } else {
      requireConfirm = true;
      await chrome.storage.local.set({ [STORAGE_KEY_REQUIRE_CONFIRM]: true });
    }
  }

  function watchSettings() {
    if (!chrome?.storage?.onChanged) return;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      if (changes[STORAGE_KEY_ENABLED]) {
        extensionEnabled = Boolean(changes[STORAGE_KEY_ENABLED].newValue);
        showToast(extensionEnabled ? "X Hotkey Blocker: ON" : "X Hotkey Blocker: OFF", "info");
      }

      if (changes[STORAGE_KEY_REQUIRE_CONFIRM]) {
        requireConfirm = Boolean(changes[STORAGE_KEY_REQUIRE_CONFIRM].newValue);
        resetPendingConfirm();
        showToast(requireConfirm ? "二段階確認: ON" : "二段階確認: OFF", "info");
      }
    });
  }

  async function blockFromPost(postEl) {
    const menuButton = findOpenMenuButton(postEl);
    if (!menuButton) return { status: "menu-button-missing" };

    menuButton.click();

    const firstMenuItem = await waitForElement('[role="menuitem"]');
    if (!firstMenuItem) return { status: "menu-not-open" };

    const menuItems = getMenuItems();
    if (isFollowingByMenuItems(menuItems)) {
      closeMenu();
      return { status: "skipped-following" };
    }

    const targetBlockItem = findBlockMenuItem(menuItems);
    if (!targetBlockItem) {
      closeMenu();
      return { status: "block-item-missing" };
    }

    targetBlockItem.click();

    const confirmButton = await waitForElement('[data-testid="confirmationSheetConfirm"]');
    if (!confirmButton) return { status: "confirm-button-missing" };

    confirmButton.click();
    return { status: "blocked" };
  }

  function notifyResult(status) {
    if (status === "blocked") {
      showToast("ブロックを実行しました", "success");
      return;
    }

    if (status === "skipped-following") {
      showToast("フォロー中ユーザーのためスキップしました", "warning");
      return;
    }

    showToast("ブロック処理に失敗しました（UI変更の可能性）", "error");
  }

  void loadSettings();
  watchSettings();

  document.addEventListener(
    "click",
    (event) => {
      if (event.button !== 0 || !hasHotkey(event)) return;

      const postEl = findPostElement(event.target);
      if (!postEl) return;

      if (!extensionEnabled) return;

      event.preventDefault();
      event.stopPropagation();

      if (isProcessing) {
        showToast("処理中です。少し待ってください", "info");
        return;
      }

      if (requireConfirm && needsSecondClick(postEl)) {
        showToast("3秒以内に同じポストをもう一度クリックで実行", "warning");
        return;
      }

      isProcessing = true;
      void blockFromPost(postEl)
        .then((result) => {
          notifyResult(result.status);
        })
        .catch(() => {
          showToast("想定外エラーが発生しました", "error");
        })
        .finally(() => {
          isProcessing = false;
          resetPendingConfirm();
        });
    },
    true
  );
})();
