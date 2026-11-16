'use strict';

/*
 * 3. Frame-rate detection.
 *
 * Browsers do not tell a web page what a video's frame rate is, so the page
 * measures it by briefly playing a hidden copy. Every test clip has a known
 * frame rate, and the measurement must come out exactly right.
 */

const { test, expect, loadSlot, settle } = require('./support/app');
const { RATES, CONTAINERS, barcode, fast } = require('./support/clips');

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

  // At half speed a 240 fps video still shows 120 frames a second, more
  // than a 60 Hz screen presents. It used to be measured as 120 fps.
  test('240 fps MP4 clip is measured as 240 fps', async ({ page }) => {
    await loadSlot(page, 0, fast.path);
    await settle(page);
    const measured = await page.evaluate(() => window.__a2o.S.slots[0].autoFps);
    expect(measured).toBeCloseTo(240, 6);
    await expect(page.locator('#scrub')).toHaveAttribute('max', String(fast.frames - 1));
  });

  // The clips above are always measured from their first frame. Real files
  // can be measured from anywhere, and a busy machine skips frames. This
  // feeds the page's estimator made-up frame times for every standard
  // rate, starting at many different frames, with and without skipped
  // frames, and with times stored exactly (MP4), rounded to whole
  // milliseconds (WebM, MKV) or cut down to whole milliseconds.
  //
  // It guards against a bug where 60 fps WebM was sometimes measured as
  // 59.94 fps. The two differ by only 0.1 percent, and the old estimator
  // used just the first and last frame time, so one millisecond of rounding
  // at either end could tip the answer.
  test('the estimator gets every standard rate right from rounded frame times', async ({ page }) => {
    const wrong = await page.evaluate(() => {
      const { estimateFps, STD_FPS } = window.__a2o;
      const storage = {
        exact: (t) => t,
        'rounded to ms': (t) => Math.round(t * 1000) / 1000,
        'cut to ms': (t) => Math.floor(t * 1000 + 1e-9) / 1000,
      };
      // Repeatable "random" frame skips.
      let seed = 7;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const out = [];
      for (const [fps, label] of STD_FPS) {
        for (const [how, store] of Object.entries(storage)) {
          for (const skip of [0, 0.1, 0.3]) {
            for (let start = 0; start < 60; start++) {
              // What the page collects: at least 45 frames over at least 1 s.
              const times = [];
              let f = start;
              while (times.length < 45 || times[times.length - 1] - times[0] < 1) {
                times.push(store(f / fps));
                f += 1;
                while (random() < skip) f += 1;
              }
              const got = estimateFps(times);
              if (got === null || Math.abs(got - fps) > 1e-9) {
                out.push(label + ' fps, ' + how + ', ' + skip * 100 + '% skipped, from frame ' + start + ': got ' + got);
              }
            }
          }
        }
      }
      return out;
    });
    expect(wrong.slice(0, 20), wrong.length + ' wrong answers (first 20 shown)').toEqual([]);
  });
});
