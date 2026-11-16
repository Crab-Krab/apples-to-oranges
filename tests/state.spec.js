'use strict';

/*
 * 9. Small state bugs found by the audit.
 *
 * - A high frame rate file opened on frame 1 or 2 instead of frame 0.
 * - Pressing play before the Encoded file had opened rewound the Original.
 * - Swap kept the offset's direction, so a hand-tuned alignment was lost.
 */

const { test, expect, loadSlot, loadPair, settle, report, seek } = require('./support/app');
const { barcode } = require('./support/clips');

test('a 60 fps file opens on frame 0', async ({ page }) => {
  await loadSlot(page, 0, barcode['60'].mp4.path);
  await settle(page);
  const r = await report(page);
  expect(r.frame).toBe(0);
  expect(r.shown[0]).toBe(0);
});

test('pressing play before the Encoded file has opened does not rewind the Original', async ({ page }) => {
  await loadSlot(page, 0, barcode['30'].mp4.path);
  await settle(page);
  await page.evaluate(() => window.__a2o.seekAll(40));
  await settle(page);
  // Loading a file pauses playback, so press play right after choosing the
  // Encoded file, while it is still opening.
  await loadSlot(page, 1, barcode['30'].webm.path);
  await page.evaluate(() => {
    const v = window.__a2o.S.slots[0].video;
    window.__seeks = 0;
    v.addEventListener('seeking', () => window.__seeks++);
    window.__a2o.play();
  });
  await page.waitForFunction(() => window.__a2o.S.slots[1].ready);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    t: window.__a2o.S.slots[0].video.currentTime, seeks: window.__seeks, playing: window.__a2o.S.playing,
    encodedPlaying: !window.__a2o.S.slots[1].video.paused,
  }));
  await page.evaluate(() => window.__a2o.pause());
  expect(after.playing).toBe(true);
  expect(after.seeks, 'times the Original jumped').toBe(0);
  expect(after.t, 'Original position in seconds').toBeGreaterThan(40 / 30);
  expect(after.encodedPlaying, 'the Encoded video joined playback').toBe(true);
});

test('Swap keeps the same two pictures paired', async ({ page }) => {
  await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
  await seek(page, 50);
  // Align the encode one frame earlier: Original 50 with Encoded 49.
  await page.click('#offMinus');
  let r = await report(page);
  expect(r.shown).toEqual([50, 49]);
  expect(r.offset).toBe(-1);

  await page.click('#swapBtn');
  r = await report(page);
  // The old Encoded (showing 49) is now the Original, still paired with 50.
  expect(r.shown).toEqual([49, 50]);
  expect(r.offset).toBe(1);
  await expect(page.locator('#offsetVal')).toHaveText('+1 frame');

  // Swapping back restores the starting state.
  await page.click('#swapBtn');
  r = await report(page);
  expect(r.shown).toEqual([50, 49]);
  expect(r.offset).toBe(-1);
});
