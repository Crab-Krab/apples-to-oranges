'use strict';

/*
 * 4. Pausing lands on the frame that was on screen.
 *
 * Each test plays the two videos and pauses twelve times. Every time, it
 * reads which frame the page had drawn at the moment of pausing, lets the
 * page settle, and checks that both videos now show that same frame.
 *
 * KNOWN BUG, EXPECTED TO FAIL: when the Original is a WebM (or MKV) file,
 * pausing often lands one frame too early. An audit measured this in 20 to
 * 47 percent of pauses, depending on the frame rate.
 *
 * Why: WebM and MKV store each frame's time rounded to a whole millisecond.
 * Frame 1 of a 30 fps video starts at 0.0333 seconds but is stored as 0.033.
 * In index.html, pause() passes that time to frameAt(), which multiplies it
 * by the frame rate and rounds down: 0.033 x 30 = 0.99, which rounds down to
 * frame 0 instead of frame 1. MP4 stores exact times and is not affected.
 *
 * The WebM tests below are therefore marked as "expected to fail". They
 * still run every time. Playwright counts an expected failure as a pass,
 * and reports a failure if such a test unexpectedly starts passing.
 *
 * WHEN THE BUG IS FIXED: those tests will show "Expected to fail, but
 * passed". Set PAUSE_BUG_IS_FIXED to true below and they become ordinary
 * tests.
 *
 * Why slow motion: to know for certain which frame was on screen, the test
 * waits until the page has drawn the same frame on two screen refreshes in
 * a row. A 60 fps video at full speed changes on every refresh, so playback
 * is slowed with the page's own Speed menu until each frame stays up for
 * several refreshes, even on a slow or busy machine. The arithmetic in
 * pause() is the same at any speed.
 */

const { test, expect, loadPair, report, seek } = require('./support/app');
const { RATES, barcode } = require('./support/clips');

const PAUSE_BUG_IS_FIXED = false;
const KNOWN_BUG_NOTE =
  'Known bug in index.html, pause() and frameAt(): WebM and MKV round frame times to whole ' +
  'milliseconds, so pausing with such a file as the Original often lands one frame early.';

const PAUSES = 12;

test.describe('Pause lands on the frame that was on screen', () => {
  // Slow-motion playback takes a while. Allow extra time on slow machines.
  test.describe.configure({ timeout: 150000 });

  for (const rate of RATES) {
    const pairs = [
      [barcode[rate.label].mp4, barcode[rate.label].webm],
      [barcode[rate.label].webm, barcode[rate.label].mp4],
    ];
    // Slow enough that at most 7.5 new frames appear per second.
    const speed = rate.fps > 30 ? '0.1' : '0.25';

    for (const [original, encoded] of pairs) {
      const knownToFail = original.container === 'webm' && !PAUSE_BUG_IS_FIXED;
      const title = original.title + ' original, ' + encoded.title + ' encode' +
        (knownToFail ? ' [known bug, expected to fail]' : '');

      test(title, async ({ page }) => {
        await loadPair(page, original, encoded);
        await page.selectOption('#speed', speed);

        const missed = [];
        let target = 4;
        for (let i = 0; i < PAUSES; i++) {
          // On a very slow machine pauses can land late. Start over from the
          // beginning rather than run off the end of the clip.
          if (target > original.frames - 20) { await seek(page, 0); target = 4; }
          const onScreen = await page.evaluate((frame) => window.__t.playThenPauseAt(frame), target);
          const after = await report(page);
          if (after.shown[0] !== onScreen || after.shown[1] !== onScreen) {
            missed.push('frame ' + onScreen + ' was on screen, but pausing landed on frame ' +
              after.shown[0] + ' (Original) and ' + after.shown[1] + ' (Encoded)');
          }
          // Carry on from here and pause again five frames later. Over twelve
          // pauses this covers frames whose stored times are rounded up,
          // rounded down, and not rounded at all.
          target = onScreen + 5;
        }

        // Only this final check is covered by the "expected to fail" mark.
        // Anything that went wrong earlier (a clip that would not load, a
        // video that would not play) still fails the test in the normal way.
        test.fail(knownToFail, KNOWN_BUG_NOTE);
        expect(missed, PAUSES + ' pauses, each should land on the frame that was on screen').toEqual([]);
      });
    }
  }
});
