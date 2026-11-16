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
  // The full-speed tests play two 60 fps videos as fast as the machine
  // allows. They run on their own, after everything else, so the load they
  // put on the machine cannot disturb timing-sensitive tests such as
  // frame-rate detection.
  projects: [
    { name: 'main', testIgnore: 'fullspeed.spec.js' },
    { name: 'full speed', testMatch: 'fullspeed.spec.js', dependencies: ['main'] },
  ],
});
