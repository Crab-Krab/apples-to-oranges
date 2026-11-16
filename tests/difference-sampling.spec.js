'use strict';

/*
 * 8. The Difference view misses nothing when zoomed out.
 *
 * Two 1920x1080 pictures differ only in isolated single pixels, one every
 * 16 pixels. Shown zoomed out (around 25 to 40 percent), one screen pixel
 * covers several video pixels. Every changed video pixel must still light
 * up one screen pixel. The page used to look at just one spot per screen
 * pixel, and an audit found most of the changes invisible at "Fit".
 */

const { test, expect, loadPair } = require('./support/app');
const { dots } = require('./support/clips');

const lit = (page) => page.evaluate(() => window.__t.litPixels(60));

for (const size of [{ width: 900, height: 600 }, { width: 1100, height: 700 }]) {
  test.describe('window ' + size.width + 'x' + size.height, () => {
    test.use({ viewport: size });

    test('every changed pixel shows up at Fit, and after panning', async ({ page }) => {
      await loadPair(page, dots.plain, dots.dotted);
      await page.click('#mode-diff');
      await page.selectOption('#diffStyle', '1'); // grayscale: unchanged pixels are pure black

      const atFit = await lit(page);
      expect(atFit.zoom).toBeLessThan(0.5);
      expect(atFit.lit, 'lit pixels at ' + Math.round(atFit.zoom * 100) + '% zoom').toBe(dots.count);

      // Zoom out a little more and nudge the picture by a fraction of a pixel.
      await page.evaluate(() => { const v = window.__a2o.S.view; v.fit = false; v.s *= 0.9; v.tx += 0.37; v.ty += 0.61; });
      const panned = await lit(page);
      expect(panned.lit, 'lit pixels at ' + Math.round(panned.zoom * 100) + '% zoom, panned').toBe(dots.count);
    });
  });
}

test('an identical pair stays black at Fit', async ({ page }) => {
  await loadPair(page, dots.plain, dots.plain);
  await page.click('#mode-diff');
  await page.selectOption('#diffStyle', '1');
  expect((await lit(page)).lit).toBe(0);
});
