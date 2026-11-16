'use strict';

/*
 * 7b. The 1:1 view is pixel-exact at 150% screen scaling.
 *
 * Same checks as sharpness.spec.js, with the browser started at real 150%
 * scaling. Two simpler setups give inconsistent answers in Chromium:
 * - Playwright's deviceScaleFactor only simulates scaling, and under it
 *   Chromium reports the canvas's exact pixel size in CSS pixels.
 * - Real scaling plus Playwright's own window size makes the page believe
 *   the scaling is 100% while the screen is at 150%.
 * So the window size is left to the browser (viewport: null).
 */

const { test } = require('./support/app');
const { sharpnessTests } = require('./support/sharpness');

test.use({
  viewport: null,
  launchOptions: { args: ['--force-device-scale-factor=1.5', '--window-size=1280,720'] },
});

sharpnessTests([{ width: 1280, height: 720, scale: 1.5 }], { setViewport: false });
