const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  reporter: "list"
});
