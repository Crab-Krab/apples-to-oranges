'use strict';

/*
 * 5. The picture the page draws.
 *
 * The other tests read frames from the hidden video players. These tests
 * read the comparison view itself, the picture the user actually looks at.
 *
 * Difference view: unchanged pixels must be black. The same file loaded on
 * both sides has no changed pixels at all. A heavily compressed copy has
 * many.
 */

const { test, expect, loadPair, seek, report } = require('./support/app');
const { barcode, lossy } = require('./support/clips');

const FRAMES = [0, 17, 99];
const brightness = (page) => page.evaluate(() => window.__t.differenceBrightness());

test.describe('Difference view', () => {
  test('the same file on both sides gives a black picture', async ({ page }) => {
    const clip = barcode['30'].webm;
    await loadPair(page, clip, clip);
    await page.click('#mode-diff');

    for (const n of FRAMES) {
      await seek(page, n);
      const seen = await brightness(page);
      expect(seen.samples).toBeGreaterThan(10000);
      // The heatmap's colour for "no difference" is an almost-black blue
      // (4 out of 255), so allow a little above zero.
      expect(seen.brightest, 'heatmap, frame ' + n).toBeLessThanOrEqual(8);
    }

    // In grayscale, "no difference" is pure black.
    await page.selectOption('#diffStyle', '1');
    expect((await brightness(page)).brightest, 'grayscale').toBe(0);
  });

  test('a heavily compressed encode does not give a black picture', async ({ page }) => {
    await loadPair(page, barcode['30'].webm, lossy);
    await page.click('#mode-diff');

    for (const n of FRAMES) {
      // Both videos are on the same frame, so anything lit comes from compression.
      expect((await seek(page, n)).shown, 'frame ' + n).toEqual([n, n]);
      const seen = await brightness(page);
      expect(seen.brightest, 'frame ' + n).toBeGreaterThan(128);
      expect(seen.litShare, 'share of clearly lit pixels, frame ' + n).toBeGreaterThan(0.1);
    }
  });

  test('the same file one frame apart does not give a black picture', async ({ page }) => {
    const clip = barcode['30'].webm;
    await loadPair(page, clip, clip);
    await page.click('#mode-diff');
    await seek(page, 17);
    expect((await brightness(page)).brightest).toBeLessThanOrEqual(8);

    await page.click('#offPlus'); // Encoded now shows frame 18 against Original frame 17
    expect((await report(page)).shown).toEqual([17, 18]);
    const seen = await brightness(page);
    expect(seen.brightest).toBeGreaterThan(128);
    expect(seen.litShare).toBeGreaterThan(0.02);
  });
});

test.describe('Side by side view', () => {
  test('both panes draw the frame the videos are on', async ({ page }) => {
    await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
    for (const n of [0, 1, 64, 149, 85]) {
      expect((await seek(page, n)).shown, 'videos, frame ' + n).toEqual([n, n]);
      const drawn = await page.evaluate(() => window.__t.framesDrawn());
      expect(drawn, 'drawn panes, frame ' + n).toEqual([n, n]);
    }
  });
});
