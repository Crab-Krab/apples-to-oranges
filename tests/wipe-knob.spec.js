'use strict';

/*
 * 14. The Wipe divider's knob is symmetric and sits exactly on the split.
 *
 * The knob used to be a font character (⇔) on a see-through circle: the
 * arrow sat off-centre in some fonts, the video tinted each half of the
 * knob differently, and the line could sit on a fraction of a pixel. The
 * left half of the knob must now mirror its right half, and the line must
 * sit on a whole screen pixel, at every divider position.
 */

const { test, expect, loadPair } = require('./support/app');
const { barcode } = require('./support/clips');

test('the knob mirrors itself and the line sits on a whole pixel', async ({ page }) => {
  await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
  await page.click('#mode-wipe');
  for (const wipe of [0.5, 0.437, 0.6131, 0.25]) {
    await page.evaluate((w) => { window.__a2o.S.wipe = w; window.__a2o.S.needsRender = true; }, wipe);
    await page.waitForTimeout(150);
    const lineX = await page.evaluate(() => parseFloat(document.getElementById('divider').style.left) * devicePixelRatio);
    expect(Math.abs(lineX - Math.round(lineX)), 'line position ' + lineX).toBeLessThan(1e-6);

    const k = await page.locator('#divider .knob').boundingBox();
    const png = await page.screenshot({ clip: { x: k.x - 4, y: k.y - 4, width: k.width + 8, height: k.height + 8 }, scale: 'device' });
    const worst = await page.evaluate(async (u) => {
      const i = new Image(); i.src = u; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height, R = W / 2 - 5;
      let worst = 0;
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W / 2; xx++) {
        const cx = xx + 0.5 - W / 2, cy = y + 0.5 - H / 2;
        if (cx * cx + cy * cy > R * R) continue; // only inside the knob
        const p1 = (y * W + xx) * 4, p2 = (y * W + (W - 1 - xx)) * 4;
        worst = Math.max(worst, (Math.abs(d[p1] - d[p2]) + Math.abs(d[p1 + 1] - d[p2 + 1]) + Math.abs(d[p1 + 2] - d[p2 + 2])) / 3);
      }
      return worst;
    }, 'data:image/png;base64,' + png.toString('base64'));
    // Smoothing at the very edge can differ by a few levels out of 255.
    expect(worst, 'largest left/right difference inside the knob at wipe ' + wipe).toBeLessThan(12);
  }
});
