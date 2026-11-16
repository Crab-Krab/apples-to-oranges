'use strict';

/*
 * 7. A hostile file name is only ever shown as text.
 *
 * A file can be named anything, including text that looks like web page
 * code. If the page pasted such a name into itself unprotected, the code in
 * the name would run. These names try exactly that: each would set
 * window.__xss if it were treated as code.
 *
 * The page shows file names in three places: the slot at the top, the
 * message after Swap, and the error window for a file that cannot be played.
 */

const fs = require('fs');
const { test, expect, loadSlot, settle } = require('./support/app');
const { barcode } = require('./support/clips');

const HOSTILE = '"><img src=x onerror="window.__xss=1">.webm';
const HOSTILE_TOO = '\'"><svg onload="window.__xss=2">.webm';

async function expectNothingRan(page) {
  expect(await page.evaluate(() => window.__xss), 'code from the file name ran').toBeUndefined();
  // No picture or other element was created out of the name.
  await expect(page.locator('img, [onerror], [onload]')).toHaveCount(0);
}

test.describe('Hostile file names', () => {
  test('are shown as text in the slots and in the Swap message', async ({ page }) => {
    const video = fs.readFileSync(barcode['30'].webm.path);
    await loadSlot(page, 0, { name: HOSTILE, mimeType: 'video/webm', buffer: video });
    await loadSlot(page, 1, { name: HOSTILE_TOO, mimeType: 'video/webm', buffer: video });
    await settle(page);

    await expect(page.locator('#slot0 .fname')).toHaveText(HOSTILE);
    await expect(page.locator('#slot0 .fname')).toHaveAttribute('title', HOSTILE);
    await expect(page.locator('#slot1 .fname')).toHaveText(HOSTILE_TOO);
    await expect(page.locator('#slot1 .fname')).toHaveAttribute('title', HOSTILE_TOO);
    await expectNothingRan(page);

    await page.click('#swapBtn');
    await expect(page.locator('#toast')).toContainText(HOSTILE_TOO);
    await expect(page.locator('#slot0 .fname')).toHaveText(HOSTILE_TOO);
    await settle(page);
    await expectNothingRan(page);
  });

  test('are shown as text in the error window of a file that cannot be played', async ({ page }) => {
    const notAVideo = Buffer.from('This is plain text, not a video.');
    await loadSlot(page, 0, { name: HOSTILE, mimeType: 'video/webm', buffer: notAVideo });

    await expect(page.locator('#codecModal')).toBeVisible();
    await expect(page.locator('#codecErr')).toContainText(HOSTILE);
    await expect(page.locator('#slot0 .fname')).toHaveText(HOSTILE);
    await expectNothingRan(page);
  });
});
