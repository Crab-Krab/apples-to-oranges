'use strict';

/*
 * 2. Paused frame accuracy.
 *
 * Whenever playback is paused, both videos must show exactly the frame the
 * page says they show. Every test clip has its frame number painted on each
 * frame, so the tests read the number straight off the decoded pictures.
 *
 * Each frame rate is tried twice: once with the MP4 clip as the Original
 * and the WebM clip as the Encoded video, and once the other way round.
 */

const {
  test, expect, loadPair, seek, report, matchingEncodedFrame, checkFrames, randomSource, randomFrame,
} = require('./support/app');
const { RATES, barcode } = require('./support/clips');

const pairs = [];
for (const rate of RATES) {
  pairs.push([barcode[rate.label].mp4, barcode[rate.label].webm]);
  pairs.push([barcode[rate.label].webm, barcode[rate.label].mp4]);
}

pairs.forEach(([original, encoded], index) => {
  test.describe(original.title + ' original, ' + encoded.title + ' encode', () => {
    const last = original.frames - 1;
    const want = (n, offset = 0) => matchingEncodedFrame(n, original, encoded, offset);

    test.beforeEach(async ({ page }) => {
      await loadPair(page, original, encoded);
    });

    test('jumping to random frames shows that frame in both videos', async ({ page }) => {
      const random = randomSource(100 + index);
      const targets = [0, last, 1, last - 1];
      while (targets.length < 30) targets.push(randomFrame(random, original));
      const mistakes = [];
      for (const n of targets) checkFrames(mistakes, 'jump to frame ' + n, await seek(page, n), n, want(n));
      expect(mistakes).toEqual([]);
    });

    test('stepping forward and back moves exactly one frame (or ten)', async ({ page }) => {
      const random = randomSource(200 + index);
      const mistakes = [];
      let n = 20 + Math.floor(random() * (last - 40));
      checkFrames(mistakes, 'jump to frame ' + n, await seek(page, n), n, want(n));

      // Arrow keys step one frame. With Shift they step ten.
      const keys = [
        ...Array(8).fill(['ArrowRight', 1]),
        ...Array(10).fill(['ArrowLeft', -1]),
        ['Shift+ArrowRight', 10], ['ArrowRight', 1], ['Shift+ArrowLeft', -10], ['ArrowLeft', -1],
      ];
      for (const [key, delta] of keys) {
        await page.keyboard.press(key);
        n += delta;
        checkFrames(mistakes, key + ' to frame ' + n, await report(page), n, want(n));
      }

      // At either end of the video, stepping further stays on the end frame.
      checkFrames(mistakes, 'jump to frame 0', await seek(page, 0), 0, want(0));
      await page.keyboard.press('ArrowLeft');
      checkFrames(mistakes, 'step back from frame 0', await report(page), 0, want(0));
      await page.keyboard.press('ArrowRight');
      checkFrames(mistakes, 'step forward from frame 0', await report(page), 1, want(1));
      checkFrames(mistakes, 'jump to the last frame', await seek(page, last), last, want(last));
      await page.keyboard.press('ArrowRight');
      checkFrames(mistakes, 'step forward from the last frame', await report(page), last, want(last));
      await page.keyboard.press('ArrowLeft');
      checkFrames(mistakes, 'step back from the last frame', await report(page), last - 1, want(last - 1));

      expect(mistakes).toEqual([]);
    });

    test('rapid scrubbing ends on the last position asked for', async ({ page }) => {
      const random = randomSource(300 + index);
      const burst = () => Array.from({ length: 60 }, () => randomFrame(random, original));
      const mistakes = [];

      // 60 jumps in a row: all at once, then with small gaps, the way
      // dragging the slider sends them. Only the final one should count.
      for (const gapMs of [0, 2, 8]) {
        const targets = burst();
        const n = targets[targets.length - 1];
        const result = await page.evaluate(([frames, gap]) => window.__t.scrub(frames, gap), [targets, gapMs]);
        checkFrames(mistakes, '60 jumps ' + gapMs + ' ms apart, ending on frame ' + n, result, n, want(n));
      }

      // The same through the real slider on the page.
      const targets = burst();
      const n = targets[targets.length - 1];
      const result = await page.evaluate((frames) => window.__t.dragSlider(frames, 4), targets);
      checkFrames(mistakes, 'dragging the slider to frame ' + n, result, n, want(n));
      expect(mistakes).toEqual([]);
      await expect(page.locator('#scrub')).toHaveValue(String(n));
      await expect(page.locator('#fcode')).toHaveText('Frame ' + n + ' (0–' + last + ')');
    });

    test('encode offset +1 and -1 shifts only the Encoded video', async ({ page }) => {
      const random = randomSource(400 + index);
      const targets = [0, 1, last - 1, last];
      while (targets.length < 10) targets.push(randomFrame(random, original));
      const mistakes = [];

      await page.click('#offPlus');
      await expect(page.locator('#offsetVal')).toHaveText('+1 frame');
      for (const n of targets) checkFrames(mistakes, 'offset +1, frame ' + n, await seek(page, n), n, want(n, 1));

      await page.click('#offMinus');
      await page.click('#offMinus');
      await expect(page.locator('#offsetVal')).toHaveText('-1 frame');
      for (const n of targets) checkFrames(mistakes, 'offset -1, frame ' + n, await seek(page, n), n, want(n, -1));

      // Clicking the number resets the offset. The "]" and "[" keys change it too.
      const n = targets[targets.length - 1];
      await page.click('#offsetVal');
      await expect(page.locator('#offsetVal')).toHaveText('0 frames');
      checkFrames(mistakes, 'offset reset, frame ' + n, await report(page), n, want(n));
      await page.keyboard.press(']');
      checkFrames(mistakes, 'offset +1 by key, frame ' + n, await report(page), n, want(n, 1));
      await page.keyboard.press('[');
      checkFrames(mistakes, 'offset back to 0 by key, frame ' + n, await report(page), n, want(n));

      expect(mistakes).toEqual([]);
    });
  });
});

/*
 * When the two files have different frame rates, frames cannot pair up one
 * to one. The page then shows whichever Encoded frame would be on screen at
 * the same moment as the Original frame, and warns about the mismatch.
 */
const mixedPairs = [
  [barcode['30'].mp4, barcode['60'].webm],
  [barcode['60'].webm, barcode['23.976'].mp4],
];

mixedPairs.forEach(([original, encoded], index) => {
  test.describe(original.title + ' original, ' + encoded.title + ' encode (different frame rates)', () => {
    test('jumping to random frames shows the Encoded frame from the same moment', async ({ page }) => {
      await loadPair(page, original, encoded);
      await expect(page.locator('#warnings')).toContainText('Frame rates differ');

      const random = randomSource(500 + index);
      const targets = [0, 1, original.frames - 1];
      while (targets.length < 25) targets.push(randomFrame(random, original));
      const mistakes = [];
      for (const n of targets) {
        checkFrames(mistakes, 'jump to frame ' + n, await seek(page, n), n, matchingEncodedFrame(n, original, encoded));
      }
      expect(mistakes).toEqual([]);
    });
  });
});
