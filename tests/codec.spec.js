'use strict';

/*
 * 6. Codec labels.
 *
 * The page peeks inside each file to name its codec, and for H.264 and HEVC
 * also the profile, bit depth and colour format. For combinations that many
 * browsers cannot play, it adds a hint explaining why.
 *
 * These tests only check the label and the hint. The label is read from the
 * file's header, so it must be right even when this browser cannot play the
 * file at all. That matters here: the Chromium that Playwright downloads may
 * have no H.264 decoder, and it has no HEVC decoder.
 */

const { test, expect, loadSlot } = require('./support/app');
const { codecs, barcode } = require('./support/clips');

const slotInfo = (page) => page.evaluate(() => {
  const s = window.__a2o.S.slots[0];
  return { codec: s.codec, hint: s.codecHint || null };
});

test.describe('Codec label', () => {
  for (const clip of codecs) {
    test(clip.file + ' is labelled "' + clip.label + '"', async ({ page }) => {
      await loadSlot(page, 0, clip.path);
      await expect.poll(async () => (await slotInfo(page)).codec, { timeout: 10000 }).toBe(clip.label);
      await expect(page.locator('#slot0 .meta')).toContainText(clip.label);

      const { hint } = await slotInfo(page);
      if (clip.hint) expect(hint, 'a hint explaining why it may not play').toContain(clip.label.split(' ')[0]);
      else expect(hint, 'no hint for a commonly supported format').toBeNull();
    });
  }

  for (const clip of [barcode['30'].mp4, barcode['30'].webm]) {
    test(clip.file + ' is labelled "VP9"', async ({ page }) => {
      await loadSlot(page, 0, clip.path);
      await expect.poll(async () => (await slotInfo(page)).codec, { timeout: 10000 }).toBe('VP9');
      await expect(page.locator('#slot0 .meta')).toContainText('VP9');
    });
  }
});
