'use strict';

/*
 * 5. At full speed, the frame number always belongs to the picture drawn.
 *
 * A 60 fps video gets a new frame on every screen refresh. The page used to
 * learn the frame number from one browser report (requestVideoFrameCallback)
 * and copy the picture a moment later. About once in a hundred refreshes a
 * newer frame arrived in between, so the view showed frame X while the page
 * believed it was showing X-1. Pausing at that moment stepped the picture
 * back one frame, and the frame counter under the view was one behind.
 *
 * The page now notes which frame it actually copied. This test plays the
 * 60 fps clip at normal speed and, on every refresh, compares the frame
 * number read from the drawn view with the frame counters under it. Both
 * counters come from the same place that pause() uses. Before the fix,
 * roughly 1 refresh in 100 disagreed, so over the 1500 refreshes checked
 * here a regression would show up almost certainly (the chance of missing
 * it is around one in a million). With the fix, none may disagree.
 *
 * It then pauses at full speed a number of times and checks that each pause
 * lands on the frame that was drawn at that moment. Thirty pauses are too
 * few to catch a one-in-a-hundred slip reliably, so the refresh check above
 * is the real guard. This one checks that pause() really uses the same
 * frame number as the counters do.
 */

const { test, expect, loadPair, seek, report } = require('./support/app');
const { barcode } = require('./support/clips');

const clip = barcode['60'].mp4;
const REFRESHES = 1500;
const PAUSES = 30;

test.describe('Full speed playback, 60 fps', () => {
  test.describe.configure({ timeout: 150000 });

  test('the frame counters match the drawn picture on every refresh', async ({ page }) => {
    await loadPair(page, clip, clip);
    const result = await page.evaluate(async (wanted) => {
      const T = window.__t, a = window.__a2o, S = a.S;
      const counter = () => {
        const n = /Frame (\d+)/.exec(document.getElementById('fcode').textContent);
        const m = /Encoded frame (\d+)/.exec(document.getElementById('encFrame').textContent);
        return [n ? +n[1] : -1, m ? +m[1] : -1];
      };
      const out = { checked: 0, mismatches: [] };
      while (out.checked < wanted) {
        a.seekAll(0);
        await T.whenSettled();
        // Play to near the end of the clip, checking every refresh.
        await new Promise((resolve) => {
          const each = () => {
            if (!S.playing) { resolve(); return; }
            const drawn = [T.frameDrawn(0), T.frameDrawn(1)];
            const said = counter();
            out.checked++;
            if (drawn[0] !== said[0] || drawn[1] !== said[1]) {
              out.mismatches.push('drawn ' + drawn.join('/') + ', counters say ' + said.join('/'));
            }
            if (out.checked >= wanted || drawn[0] >= 280) { a.pause(); resolve(); return; }
            S.needsRender = true;
            requestAnimationFrame(each);
          };
          a.play();
          S.needsRender = true;
          requestAnimationFrame(each);
        });
      }
      return out;
    }, REFRESHES);
    expect(result.checked).toBeGreaterThanOrEqual(REFRESHES);
    expect(result.mismatches, result.checked + ' refreshes checked (Original/Encoded)').toEqual([]);
  });

  test('pausing lands on the frame that was drawn', async ({ page }) => {
    await loadPair(page, clip, clip);
    const missed = [];
    for (let i = 0; i < PAUSES; i++) {
      // Start somewhere different each time and play for a varying number
      // of refreshes, so pauses fall at many different moments.
      await seek(page, 10 + ((i * 37) % 200));
      const onScreen = await page.evaluate((refreshes) => new Promise((resolve) => {
        const T = window.__t, a = window.__a2o;
        let k = 0;
        const each = () => {
          if (++k >= refreshes) { const drawn = T.frameDrawn(0); a.pause(); resolve(drawn); return; }
          a.S.needsRender = true;
          requestAnimationFrame(each);
        };
        a.play();
        a.S.needsRender = true;
        requestAnimationFrame(each);
      }), 8 + ((i * 13) % 30));
      const after = await page.evaluate(() => window.__t.report());
      if (after.shown[0] !== onScreen || after.shown[1] !== onScreen) {
        // Include what the page itself believed, so a rare failure on a
        // shared test machine says which side went wrong.
        missed.push('frame ' + onScreen + ' was drawn, but pausing landed on frame ' +
          after.shown[0] + ' (Original) and ' + after.shown[1] + ' (Encoded). The page asked for ' +
          after.frame + ' and ' + after.encFrame + '.');
      }
    }
    expect(missed, PAUSES + ' pauses at full speed').toEqual([]);
  });
});

// On a busy machine the drawing can fall behind the video's own clock. The
// page used to trust the drawn picture's frame number only if it was less
// than half a second behind the clock, and otherwise paused on the clock's
// frame, a frame the viewer had never seen. Here the page is frozen for 0.8
// seconds during playback (the video's clock keeps running while nothing is
// drawn) and then paused straight away. It must land on the frame that was
// on screen, not on the clock's.
test('pausing after the drawing fell behind lands on the frame on screen', async ({ page }) => {
  const clip30 = barcode['30'].mp4;
  await loadPair(page, clip30, clip30);
  for (const start of [10, 60]) {
    await seek(page, start);
    const onScreen = await page.evaluate(() => new Promise((resolve) => {
      const T = window.__t, a = window.__a2o;
      let k = 0;
      const each = () => {
        if (++k >= 10) {
          const drawn = T.frameDrawn(0);
          const until = performance.now() + 800;
          while (performance.now() < until) { /* the page is frozen */ }
          a.pause();
          resolve(drawn);
          return;
        }
        a.S.needsRender = true;
        requestAnimationFrame(each);
      };
      a.play();
      a.S.needsRender = true;
      requestAnimationFrame(each);
    }));
    const after = await report(page);
    expect(after.shown, 'frame ' + onScreen + ' was on screen when paused').toEqual([onScreen, onScreen]);
  }
});
