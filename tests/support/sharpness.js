'use strict';

/*
 * Shared checks for sharpness.spec.js and sharpness-150.spec.js. See the
 * notes in sharpness.spec.js.
 */

const { test, expect, loadPair } = require('./app');
const { checker } = require('./clips');

// Share of pixels in a screenshot area that are neither near-black nor
// near-white. The picture is decoded inside the page, because the test
// runner has no image library of its own.
async function greyShare(page, box) {
  const png = await page.screenshot({ clip: box, scale: 'device' });
  return page.evaluate(async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let grey = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (v > 8 && v < 247) grey++;
    }
    return { grey, total: d.length / 4 };
  }, 'data:image/png;base64,' + png.toString('base64'));
}

// An 80 x 80 area at a given spot of the canvas, in CSS pixels. `fx` and
// `fy` are fractions of the canvas width and height.
async function areaAt(page, fx, fy) {
  const r = await page.locator('#gl').boundingBox();
  return { x: Math.round(r.x + r.width * fx) - 40, y: Math.round(r.y + r.height * fy) - 40, width: 80, height: 80 };
}

async function expectSharp(page, fx, fy, what) {
  const result = await greyShare(page, await areaAt(page, fx, fy));
  expect(result.total).toBeGreaterThan(1000);
  expect(result.grey, what + ': grey (blurred) pixels out of ' + result.total).toBe(0);
}

const oneToOne = (page) => page.evaluate(() => window.__a2o.oneToOne());

// `setViewport: false` leaves the window size to the browser, for a spec
// file that starts the browser with real screen scaling (see
// sharpness-150.spec.js).
function sharpnessTests(screens, { setViewport = true } = {}) {
  for (const screen of screens) {
  test.describe(screen.width + 'x' + screen.height + ' at ' + screen.scale * 100 + '% scaling', () => {
    if (setViewport) test.use({ viewport: { width: screen.width, height: screen.height } });

    test('Side by side at 1:1 is sharp', async ({ page }) => {
      await loadPair(page, checker, checker);
      await oneToOne(page);
      await page.waitForTimeout(200);
      // The centre of the left pane.
      await expectSharp(page, 0.25, 0.5, 'Side by side');
    });

    test('1:1 stays sharp after switching to Wipe', async ({ page }) => {
      await loadPair(page, checker, checker);
      await oneToOne(page);
      await page.click('#mode-wipe');
      await page.waitForTimeout(200);
      // Left of centre, away from the wipe divider line.
      await expectSharp(page, 0.42, 0.5, 'Wipe after Side by side');
    });

    test('1:1 stays sharp after dragging the picture', async ({ page }) => {
      await loadPair(page, checker, checker);
      await page.click('#mode-wipe');
      await oneToOne(page);
      const r = await page.locator('#gl').boundingBox();
      // Drag away from the divider. 37 CSS pixels at 150% scaling is 55.5
      // screen pixels, a half-pixel move.
      const x = r.x + r.width * 0.3, y = r.y + r.height * 0.5;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 37, y + 23, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      await expectSharp(page, 0.4, 0.5, 'after a drag');
    });
  });
}
}

module.exports = { sharpnessTests };
