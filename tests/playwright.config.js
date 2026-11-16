'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  // Makes the test clips with ffmpeg before the first test runs.
  globalSetup: require.resolve('./support/global-setup.js'),
  outputDir: 'test-results',
  timeout: 60000,
  // No automatic second attempts. A test that only passes sometimes is a
  // finding in its own right (the pause bug began as exactly that).
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    trace: 'off',
  },
});
