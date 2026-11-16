'use strict';

/*
 * 10. The page notices when a video can't show the frame it asked for.
 *
 * After every jump the page compares the time stamp of the picture it got
 * with the frame it asked for, and shows a warning when they differ. Two
 * broken files are made for this test:
 * - a WebM file cut off at 40% of its size (as if a download stopped), and
 * - a clip with 2 seconds of video but 5 seconds of audio, so the file
 *   claims to be 5 seconds long but has no pictures after 2 seconds.
 * A normal file must never trigger the warning.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect, loadSlot, loadPair, settle, seek } = require('./support/app');
const { MEDIA_DIR, barcode } = require('./support/clips');

const truncated = path.join(MEDIA_DIR, 'cut-off-30fps.webm');
const audioLonger = path.join(MEDIA_DIR, 'audio-longer-than-video.webm');

test.beforeAll(() => {
  const whole = fs.readFileSync(barcode['30'].webm.path);
  fs.writeFileSync(truncated, whole.subarray(0, Math.floor(whole.length * 0.4)));
  if (!fs.existsSync(audioLonger)) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
      '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-c:a', 'libopus', audioLonger]);
  }
});

const warnings = (page) => page.locator('#warnings');
const MESSAGE = /is showing its frame \d+, not frame \d+/;

test('a normal pair never shows the warning', async ({ page }) => {
  await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
  for (const n of [0, 1, 37, 100, 149]) {
    await seek(page, n);
    await page.waitForTimeout(100);
    await expect(warnings(page)).not.toContainText(MESSAGE);
  }
});

test('a cut-off file is flagged when a missing frame is asked for', async ({ page }) => {
  await loadSlot(page, 0, truncated);
  await settle(page);
  await seek(page, 5);
  await page.waitForTimeout(200);
  await expect(warnings(page)).not.toContainText(MESSAGE);
  const last = await page.evaluate(() => Math.round(window.__a2o.S.slots[0].duration * window.__a2o.fpsOf(window.__a2o.S.slots[0])) - 1);
  await seek(page, last);
  await expect(warnings(page)).toContainText(MESSAGE, { timeout: 5000 });
});

test('a file with audio longer than its video is flagged past the last picture', async ({ page }) => {
  await loadSlot(page, 0, audioLonger);
  await settle(page);
  await seek(page, 120); // 4 seconds in: there is no picture there
  await expect(warnings(page)).toContainText('The Original is showing its frame', { timeout: 5000 });
  await seek(page, 10); // back where pictures exist: the warning goes away
  await expect(warnings(page)).not.toContainText(MESSAGE, { timeout: 5000 });
});
