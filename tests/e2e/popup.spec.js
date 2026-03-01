const path = require("path");
const { test, expect } = require("@playwright/test");

function popupFileUrl() {
  const filePath = path.resolve(__dirname, "../../popup.html");
  return `file://${filePath}`;
}

async function openPopupWithMockStorage(page, initialData = {}) {
  await page.addInitScript((seed) => {
    const store = { ...seed };
    const listeners = [];

    function notify(changes) {
      for (const listener of listeners) {
        listener(changes, "local");
      }
    }

    window.chrome = {
      storage: {
        local: {
          async get(keys) {
            if (Array.isArray(keys)) {
              const out = {};
              for (const key of keys) out[key] = store[key];
              return out;
            }
            if (typeof keys === "string") {
              return { [keys]: store[keys] };
            }
            if (keys && typeof keys === "object") {
              const out = {};
              for (const key of Object.keys(keys)) {
                out[key] = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : keys[key];
              }
              return out;
            }
            return { ...store };
          },
          async set(values) {
            const changes = {};
            for (const [key, value] of Object.entries(values)) {
              changes[key] = { oldValue: store[key], newValue: value };
              store[key] = value;
            }
            notify(changes);
          }
        },
        onChanged: {
          addListener(listener) {
            listeners.push(listener);
          }
        }
      }
    };
  }, initialData);

  await page.goto(popupFileUrl());
}

test.describe("popup e2e", () => {
  test("初期状態のトグルがONで表示される", async ({ page }) => {
    await openPopupWithMockStorage(page);

    await expect(page.locator("#enabled-toggle")).toBeChecked();
    await expect(page.locator("#confirm-toggle")).toBeChecked();
    await expect(page.locator("#status-text")).toContainText("機能 ON");
    await expect(page.locator("#status-text")).toContainText("二段階確認 ON");
  });

  test("履歴が保存されるとpopupに表示される", async ({ page }) => {
    await openPopupWithMockStorage(page, {
      executionHistory: [
        {
          timestamp: Date.now(),
          status: "blocked",
          label: "実行成功",
          screenName: "@example_user",
          postKey: "123"
        }
      ]
    });

    const firstItem = page.locator("#history-list .history-item").first();
    await expect(firstItem).toContainText("実行成功");
    await expect(firstItem).toContainText("@example_user");
  });

  test("トグル変更でステータス表示が更新される", async ({ page }) => {
    await openPopupWithMockStorage(page);

    await page.locator("#enabled-toggle").uncheck();
    await page.locator("#confirm-toggle").uncheck();

    await expect(page.locator("#status-text")).toContainText("機能 OFF");
    await expect(page.locator("#status-text")).toContainText("二段階確認 OFF");
  });
});
