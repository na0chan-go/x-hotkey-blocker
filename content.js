(() => {
  const isMac = navigator.platform.toLowerCase().includes("mac");

  function hasHotkey(event) {
    return isMac ? event.metaKey : event.ctrlKey;
  }

  function sleep(ms) {
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

  function findBlockMenuItem() {
    const candidates = Array.from(document.querySelectorAll('[role="menuitem"]'));
    return (
      candidates.find((item) => /block\s*@/i.test(item.textContent || "")) ||
      candidates.find((item) => /(ブロック|block)/i.test(item.textContent || ""))
    );
  }

  async function blockFromPost(postEl) {
    const menuButton = findOpenMenuButton(postEl);
    if (!menuButton) {
      console.warn("[x-hotkey-blocker] menu button not found");
      return;
    }

    menuButton.click();

    const blockItem = await waitForElement('[role="menuitem"]');
    if (!blockItem) {
      console.warn("[x-hotkey-blocker] menu did not open");
      return;
    }

    const targetBlockItem = findBlockMenuItem();
    if (!targetBlockItem) {
      console.warn("[x-hotkey-blocker] block menu item not found");
      return;
    }

    targetBlockItem.click();

    const confirmButton = await waitForElement('[data-testid="confirmationSheetConfirm"]');
    if (!confirmButton) {
      console.warn("[x-hotkey-blocker] block confirmation button not found");
      return;
    }

    confirmButton.click();
    console.info("[x-hotkey-blocker] block attempted");
  }

  document.addEventListener(
    "click",
    (event) => {
      if (event.button !== 0 || !hasHotkey(event)) return;

      const postEl = findPostElement(event.target);
      if (!postEl) return;

      event.preventDefault();
      event.stopPropagation();

      void blockFromPost(postEl);
    },
    true
  );
})();
