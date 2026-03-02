(() => {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const UNFOLLOW_MENU_PATTERNS = [/\bunfollow\b/i, /フォロー.*解除/];
  const CONFIRM_WINDOW_MS = 3000;
  const STORAGE_KEY_ENABLED = "enabled";
  const STORAGE_KEY_REQUIRE_CONFIRM = "requireConfirm";
  const STORAGE_KEY_HISTORY = "executionHistory";
  const STORAGE_KEY_TRIGGER_MODIFIER = "triggerModifier";
  const STORAGE_KEY_TRIGGER_MOUSE_BUTTON = "triggerMouseButton";
  const MAX_HISTORY_ITEMS = 30;
  const ALLOWED_MODIFIERS = ["meta", "ctrl", "alt", "shift", "none"];
  const ALLOWED_MOUSE_BUTTONS = ["left", "middle", "right"];
  const INLINE_BUTTON_ATTR = "data-xhb-inline-button";
  const INLINE_BUTTON_STYLE_ID = "xhb-inline-button-style";

  let extensionEnabled = true;
  let requireConfirm = true;
  let triggerModifier = isMac ? "meta" : "ctrl";
  let triggerMouseButton = "left";
  let isProcessing = false;
  let pendingConfirm = null;
  let toastRoot = null;

  function normalizeModifier(value) {
    return ALLOWED_MODIFIERS.includes(value) ? value : isMac ? "meta" : "ctrl";
  }

  function normalizeMouseButton(value) {
    return ALLOWED_MOUSE_BUTTONS.includes(value) ? value : "left";
  }

  function hasHotkey(event) {
    if (triggerModifier === "none") return true;
    if (triggerModifier === "meta") return event.metaKey;
    if (triggerModifier === "ctrl") return event.ctrlKey;
    if (triggerModifier === "alt") return event.altKey;
    if (triggerModifier === "shift") return event.shiftKey;
    return false;
  }

  function matchesMouseButton(event) {
    if (triggerMouseButton === "left") return event.button === 0;
    if (triggerMouseButton === "middle") return event.button === 1;
    if (triggerMouseButton === "right") return event.button === 2;
    return false;
  }

  function getTriggerSummary() {
    const modifierLabelMap = {
      meta: isMac ? "Cmd" : "Meta",
      ctrl: "Ctrl",
      alt: "Alt",
      shift: "Shift",
      none: "修飾キーなし"
    };

    const mouseButtonLabelMap = {
      left: "左クリック",
      middle: "中クリック",
      right: "右クリック"
    };

    return `${modifierLabelMap[triggerModifier]} + ${mouseButtonLabelMap[triggerMouseButton]}`;
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

  async function closeMenu(menuButton) {
    for (let i = 0; i < 4; i += 1) {
      if (getMenuItems().length === 0) return;

      const escOptions = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true };
      document.dispatchEvent(new KeyboardEvent("keydown", escOptions));
      document.dispatchEvent(new KeyboardEvent("keyup", escOptions));
      if (document.activeElement) {
        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", escOptions));
        document.activeElement.dispatchEvent(new KeyboardEvent("keyup", escOptions));
      }
      await sleep(80);
      if (getMenuItems().length === 0) return;

      if (menuButton && menuButton.isConnected) {
        menuButton.click();
        await sleep(80);
        if (getMenuItems().length === 0) return;
      }

      const clickTarget = document.elementFromPoint(8, 8) || document.body;
      if (clickTarget) {
        const mouseOptions = { bubbles: true, button: 0, clientX: 8, clientY: 8 };
        clickTarget.dispatchEvent(new MouseEvent("mousedown", mouseOptions));
        clickTarget.dispatchEvent(new MouseEvent("mouseup", mouseOptions));
        clickTarget.dispatchEvent(new MouseEvent("click", mouseOptions));
      }
      await sleep(80);
    }

    if (getMenuItems().length > 0) {
      showToast("メニューを自動で閉じきれませんでした", "warning");
    }
  }

  function getStatusHref(postEl) {
    const statusLink = postEl.querySelector('a[href*="/status/"]');
    return statusLink ? statusLink.getAttribute("href") || "" : "";
  }

  function getPostKey(postEl) {
    const href = getStatusHref(postEl);
    if (!href) return null;

    const match = href.match(/\/status\/(\d+)/);
    if (match) return match[1];
    return href;
  }

  function getScreenName(postEl) {
    const href = getStatusHref(postEl);
    if (!href) return "unknown";

    const match = href.match(/^\/([^/]+)\/status\//);
    if (!match) return "unknown";
    return `@${match[1]}`;
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

  function ensureInlineButtonStyles() {
    if (document.getElementById(INLINE_BUTTON_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = INLINE_BUTTON_STYLE_ID;
    style.textContent = `
      button[${INLINE_BUTTON_ATTR}="1"] {
        border: 1px solid rgba(255, 255, 255, 0.25);
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        border-radius: 999px;
        width: 26px;
        height: 26px;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
      }
      button[${INLINE_BUTTON_ATTR}="1"]:hover {
        background: rgba(220, 38, 38, 0.85);
      }
      button[${INLINE_BUTTON_ATTR}="1"]:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  function findActionBar(postEl) {
    const groups = Array.from(postEl.querySelectorAll('div[role="group"]'));
    return groups.find((group) => group.querySelector("button, [role='button']")) || null;
  }

  function getDirectChild(parent, node) {
    let current = node;
    while (current && current.parentElement !== parent) {
      current = current.parentElement;
    }
    return current && current.parentElement === parent ? current : null;
  }

  function findGrokAnchorNode(actionBar) {
    const candidates = Array.from(actionBar.querySelectorAll("[data-testid], [aria-label]"));
    return (
      candidates.find((el) => {
        const dt = (el.getAttribute("data-testid") || "").toLowerCase();
        const al = (el.getAttribute("aria-label") || "").toLowerCase();
        return dt.includes("grok") || al.includes("grok");
      }) || null
    );
  }

  function updateInlineButtonsState() {
    const buttons = document.querySelectorAll(`button[${INLINE_BUTTON_ATTR}="1"]`);
    buttons.forEach((button) => {
      button.disabled = !extensionEnabled;
      button.title = extensionEnabled ? "このユーザーをブロック" : "機能がOFFです";
    });
  }

  function injectInlineButtonIntoPost(postEl) {
    if (postEl.querySelector(`button[${INLINE_BUTTON_ATTR}="1"]`)) return;

    const actionBar = findActionBar(postEl);
    if (!actionBar) return;

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(INLINE_BUTTON_ATTR, "1");
    button.textContent = "🚫";
    button.title = extensionEnabled ? "このユーザーをブロック" : "機能がOFFです";
    button.disabled = !extensionEnabled;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void triggerBlockForPost(postEl, { source: "inline-button" });
    });

    const grokNode = findGrokAnchorNode(actionBar);
    if (grokNode) {
      const anchor = getDirectChild(actionBar, grokNode);
      if (anchor && anchor.nextSibling) {
        actionBar.insertBefore(button, anchor.nextSibling);
        return;
      }
      if (anchor) {
        actionBar.appendChild(button);
        return;
      }
    }

    actionBar.appendChild(button);
  }

  function scanAndInjectInlineButtons(root) {
    const base = root && root.querySelectorAll ? root : document;
    const posts = base.querySelectorAll('article[data-testid="tweet"]');
    posts.forEach((postEl) => injectInlineButtonIntoPost(postEl));
  }

  function setupInlineButtons() {
    ensureInlineButtonStyles();
    scanAndInjectInlineButtons(document);
    updateInlineButtonsState();

    if (!document.body) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          if (node.matches && node.matches('article[data-testid="tweet"]')) {
            injectInlineButtonIntoPost(node);
            continue;
          }

          if (node.querySelectorAll) {
            scanAndInjectInlineButtons(node);
          }
        }
      }
      updateInlineButtonsState();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function loadSettings() {
    if (!chrome?.storage?.local) return;

    const data = await chrome.storage.local.get([
      STORAGE_KEY_ENABLED,
      STORAGE_KEY_REQUIRE_CONFIRM,
      STORAGE_KEY_TRIGGER_MODIFIER,
      STORAGE_KEY_TRIGGER_MOUSE_BUTTON
    ]);

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

    const normalizedModifier = normalizeModifier(data[STORAGE_KEY_TRIGGER_MODIFIER]);
    const normalizedMouseButton = normalizeMouseButton(data[STORAGE_KEY_TRIGGER_MOUSE_BUTTON]);
    triggerModifier = normalizedModifier;
    triggerMouseButton = normalizedMouseButton;

    const needsPersistTrigger =
      normalizedModifier !== data[STORAGE_KEY_TRIGGER_MODIFIER] ||
      normalizedMouseButton !== data[STORAGE_KEY_TRIGGER_MOUSE_BUTTON];

    if (needsPersistTrigger) {
      await chrome.storage.local.set({
        [STORAGE_KEY_TRIGGER_MODIFIER]: normalizedModifier,
        [STORAGE_KEY_TRIGGER_MOUSE_BUTTON]: normalizedMouseButton
      });
    }

    updateInlineButtonsState();
  }

  function watchSettings() {
    if (!chrome?.storage?.onChanged) return;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      if (changes[STORAGE_KEY_ENABLED]) {
        extensionEnabled = Boolean(changes[STORAGE_KEY_ENABLED].newValue);
        showToast(extensionEnabled ? "X Hotkey Blocker: ON" : "X Hotkey Blocker: OFF", "info");
        updateInlineButtonsState();
      }

      if (changes[STORAGE_KEY_REQUIRE_CONFIRM]) {
        requireConfirm = Boolean(changes[STORAGE_KEY_REQUIRE_CONFIRM].newValue);
        resetPendingConfirm();
        showToast(requireConfirm ? "二段階確認: ON" : "二段階確認: OFF", "info");
      }

      if (changes[STORAGE_KEY_TRIGGER_MODIFIER]) {
        triggerModifier = normalizeModifier(changes[STORAGE_KEY_TRIGGER_MODIFIER].newValue);
      }

      if (changes[STORAGE_KEY_TRIGGER_MOUSE_BUTTON]) {
        triggerMouseButton = normalizeMouseButton(changes[STORAGE_KEY_TRIGGER_MOUSE_BUTTON].newValue);
      }

      if (changes[STORAGE_KEY_TRIGGER_MODIFIER] || changes[STORAGE_KEY_TRIGGER_MOUSE_BUTTON]) {
        resetPendingConfirm();
        showToast(`トリガーを変更: ${getTriggerSummary()}`, "info");
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
      await closeMenu(menuButton);
      return { status: "skipped-following" };
    }

    const targetBlockItem = findBlockMenuItem(menuItems);
    if (!targetBlockItem) {
      await closeMenu(menuButton);
      return { status: "block-item-missing" };
    }

    targetBlockItem.click();

    const confirmButton = await waitForElement('[data-testid="confirmationSheetConfirm"]');
    if (!confirmButton) return { status: "confirm-button-missing" };

    confirmButton.click();
    return { status: "blocked" };
  }

  function getStatusSummary(status) {
    if (status === "blocked") return { label: "実行成功", variant: "success" };
    if (status === "skipped-following") return { label: "フォロー中でスキップ", variant: "warning" };
    if (status === "unexpected-error") return { label: "想定外エラー", variant: "error" };
    return { label: "実行失敗", variant: "error" };
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

  async function appendExecutionHistory(status, postEl) {
    if (!chrome?.storage?.local) return;

    const summary = getStatusSummary(status);
    const entry = {
      timestamp: Date.now(),
      status,
      label: summary.label,
      screenName: getScreenName(postEl),
      postKey: getPostKey(postEl)
    };

    const data = await chrome.storage.local.get(STORAGE_KEY_HISTORY);
    const current = Array.isArray(data[STORAGE_KEY_HISTORY]) ? data[STORAGE_KEY_HISTORY] : [];
    const next = [entry, ...current].slice(0, MAX_HISTORY_ITEMS);
    await chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: next });
  }

  async function triggerBlockForPost(postEl, options = {}) {
    const source = options.source || "hotkey";

    if (!extensionEnabled) {
      showToast("機能がOFFです", "info");
      return;
    }

    if (isProcessing) {
      showToast("処理中です。少し待ってください", "info");
      return;
    }

    if (source === "hotkey" && requireConfirm && needsSecondClick(postEl)) {
      showToast("3秒以内に同じポストをもう一度クリックで実行", "warning");
      return;
    }

    isProcessing = true;
    try {
      const result = await blockFromPost(postEl);
      notifyResult(result.status);
      await appendExecutionHistory(result.status, postEl);
    } catch {
      showToast("想定外エラーが発生しました", "error");
      await appendExecutionHistory("unexpected-error", postEl);
    } finally {
      isProcessing = false;
      resetPendingConfirm();
    }
  }

  void loadSettings();
  watchSettings();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupInlineButtons, { once: true });
  } else {
    setupInlineButtons();
  }

  document.addEventListener(
    "click",
    (event) => {
      if (!matchesMouseButton(event) || !hasHotkey(event)) return;

      const postEl = findPostElement(event.target);
      if (!postEl) return;

      event.preventDefault();
      event.stopPropagation();

      void triggerBlockForPost(postEl, { source: "hotkey" });
    },
    true
  );
})();
