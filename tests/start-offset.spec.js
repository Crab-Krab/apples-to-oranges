'use strict';

/*
 * 13. Files whose first frame doesn't start at 0 seconds.
 *
 * MKV files remuxed from DVDs often start a fraction of a frame late. The
 * tool used to count frames from 0 s, so for such a file it jumped to just
 * before the frame it wanted and showed the previous one, flagging "showing
 * its frame 20926, not frame 20927" on almost every step. It now measures
 * each file's first frame time and counts from there.
 *
 * The Original here starts at 0.021 s, the Encoded is the same pictures
 * starting at 0 s. Every check must find both showing the same frame.
 */

const { test, expect, loadPair, seek, report } = require('./support/app');
const { barcode, delayed } = require('./support/clips');

const MESSAGE = /is showing its frame/;

test('the late-starting file is measured as starting at 0.021 s', async ({ page }) => {
  await loadPair(page, delayed, barcode['30'].webm);
  const starts = await page.evaluate(() => window.__a2o.S.slots.map((s) => s.start));
  expect(starts[0]).toBeCloseTo(delayed.start, 3);
  expect(starts[1]).toBeCloseTo(0, 3);
});

test('jumping and stepping land on the asked frame in both videos', async ({ page }) => {
  await loadPair(page, delayed, barcode['30'].webm);
  const wrong = [];
  for (const n of [0, 1, 2, 17, 48, 49, 100, 101, 148, 149]) {
    const r = await seek(page, n);
    if (r.shown[0] !== n || r.shown[1] !== n) wrong.push('asked ' + n + ', shown ' + r.shown.join('/'));
  }
  await seek(page, 60);
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__a2o.step(1));
    const r = await report(page);
    if (r.shown[0] !== r.frame || r.shown[1] !== r.frame) wrong.push('step to ' + r.frame + ', shown ' + r.shown.join('/'));
  }
  expect(wrong).toEqual([]);
  await expect(page.locator('#warnings')).not.toContainText(MESSAGE);
});

test('after playing and pausing, both videos show the frame that was on screen', async ({ page }) => {
  await loadPair(page, delayed, barcode['30'].webm);
  for (const start of [20, 80]) {
    await seek(page, start);
    const onScreen = await page.evaluate(() => new Promise((resolve) => {
      const T = window.__t, a = window.__a2o;
      let k = 0;
      const each = () => {
        if (++k >= 20) { const drawn = T.frameDrawn(0); a.pause(); resolve(drawn); return; }
        a.S.needsRender = true;
        requestAnimationFrame(each);
      };
      a.play();
      a.S.needsRender = true;
      requestAnimationFrame(each);
    }));
    const r = await report(page);
    expect(r.shown, 'frame ' + onScreen + ' was on screen').toEqual([onScreen, onScreen]);
  }
  await expect(page.locator('#warnings')).not.toContainText(MESSAGE);
});
