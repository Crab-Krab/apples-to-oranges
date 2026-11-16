'use strict';

/*
 * 3. Frame-rate detection.
 *
 * Browsers do not tell a web page what a video's frame rate is, so the page
 * measures it by briefly playing a hidden copy. Every test clip has a known
 * frame rate, and the measurement must come out exactly right.
 */

const { test, expect, loadSlot, settle } = require('./support/app');
const { RATES, CONTAINERS, barcode } = require('./support/clips');

test.describe('Frame-rate detection', () => {
  for (const rate of RATES) {
    for (const container of CONTAINERS) {
      const clip = barcode[rate.label][container.ext];

      test(clip.title + ' clip is measured as ' + rate.label + ' fps', async ({ page }) => {
        await loadSlot(page, 0, clip.path);
        await settle(page);

        const slot = await page.evaluate(() => {
          const s = window.__a2o.S.slots[0];
          return { measured: s.autoFps, failed: s.fpsFailed, used: window.__a2o.fpsOf(s) };
        });
        expect(slot.failed).toBe(false);
        expect(slot.measured).toBeCloseTo(clip.fps, 6);
        expect(slot.used).toBeCloseTo(clip.fps, 6);

        // The page shows the result, and counts the right number of frames with it.
        await expect(page.locator('#slot0 .meta')).toContainText(rate.label + ' fps');
        await expect(page.locator('#fps0 option:checked')).toHaveText('Auto (' + rate.label + ')');
        await expect(page.locator('#scrub')).toHaveAttribute('max', String(clip.frames - 1));
        await expect(page.locator('#warnings')).toBeEmpty();
      });
    }
  }
});
