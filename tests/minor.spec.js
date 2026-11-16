'use strict';

/*
 * 11. Low-severity behavior found by the audit.
 */

const { test, expect, loadSlot, loadPair, settle, report } = require('./support/app');
const { barcode } = require('./support/clips');

test('pausing the Original from outside the page (media keys) pauses the app', async ({ page }) => {
  await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
  await page.evaluate(() => window.__a2o.play());
  await page.waitForFunction(() => window.__a2o.S.slots[0].video.currentTime > 0.5);
  // What a media key does: pause the video element directly.
  await page.evaluate(() => window.__a2o.S.slots[0].video.pause());
  await page.waitForFunction(() => !window.__a2o.S.playing);
  const r = await report(page);
  expect(r.shown[0]).toBe(r.frame);
  expect(await page.evaluate(() => window.__a2o.S.slots[1].video.paused), 'Encoded stopped too').toBe(true);
  await expect(page.locator('#playBtn')).toHaveAttribute('aria-label', 'Play');
});

test('playing the Original from outside the page starts the app', async ({ page }) => {
  await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
  await page.evaluate(() => window.__a2o.S.slots[0].video.play());
  await page.waitForFunction(() => window.__a2o.S.playing && !window.__a2o.S.slots[1].video.paused);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__a2o.S.playing), 'still playing').toBe(true);
  await page.evaluate(() => window.__a2o.pause());
});

test('playing to the end still lands on the last frame', async ({ page }) => {
  await loadSlot(page, 0, barcode['30'].mp4.path);
  await settle(page);
  await page.evaluate(() => { window.__a2o.seekAll(140); });
  await settle(page);
  await page.evaluate(() => window.__a2o.play());
  await page.waitForFunction(() => !window.__a2o.S.playing, null, { timeout: 10000 });
  const r = await report(page);
  expect(r.frame).toBe(barcode['30'].mp4.frames - 1);
});

test('with three files, the two largest are used and the rest are named', async ({ page }) => {
  const big = { name: 'big.webm', mimeType: 'video/webm', buffer: require('fs').readFileSync(barcode['30'].webm.path) };
  const mid = { name: 'mid.webm', mimeType: 'video/webm', buffer: require('fs').readFileSync(barcode['30'].webm.path).subarray(0) };
  const small = { name: 'small.webm', mimeType: 'video/webm', buffer: Buffer.from(require('fs').readFileSync(barcode['30'].webm.path)).subarray(0, 50000) };
  // Make "mid" a little smaller than "big" so the order is unambiguous.
  mid.buffer = mid.buffer.subarray(0, mid.buffer.length - 10);
  await page.setInputFiles('#file0', [small, big, mid]);
  await page.waitForFunction(() => window.__a2o.S.slots[0].file && window.__a2o.S.slots[1].file);
  const names = await page.evaluate(() => window.__a2o.S.slots.map((s) => s.file.name));
  expect(names).toEqual(['big.webm', 'mid.webm']);
  await expect(page.locator('#toast')).toContainText('small.webm');
});

test('dropping a file on a file box does not leave the drop overlay up', async ({ page }) => {
  const viewer = page.locator('#viewer');
  const data = await page.evaluateHandle(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.txt', { type: 'text/plain' })); return dt; });
  // Drag over the page, then drop on the Original box.
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: data });
  await expect(viewer).toHaveClass(/dragover/);
  await page.dispatchEvent('#slot0', 'drop', { dataTransfer: data });
  // A later drag that is cancelled must clear the overlay.
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: data });
  await page.dispatchEvent('body', 'dragleave', { dataTransfer: data });
  await expect(viewer).not.toHaveClass(/dragover/);
});

test('with only an Encoded video, Play and step explain what is missing', async ({ page }) => {
  await loadSlot(page, 1, barcode['30'].webm.path);
  await page.waitForFunction(() => window.__a2o.S.slots[1].ready);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#toast')).toContainText('Load an Original video too');
});

test('a transport stream file that fails gets a hint on how to repackage it', async ({ page }) => {
  await page.setInputFiles('#file0', { name: 'capture.ts', mimeType: 'video/mp2t', buffer: Buffer.alloc(188 * 50, 0x47) });
  await expect(page.locator('#codecErr')).toContainText('ffmpeg -i input.ts -c copy output.mp4', { timeout: 25000 });
  // The test fixture fails a test on console errors. A failed load logs none.
});
