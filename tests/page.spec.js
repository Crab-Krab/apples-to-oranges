'use strict';

/*
 * 1. The page opens cleanly and keeps everything on the computer.
 *
 * The tool promises that videos never leave the user's machine. These tests
 * watch every address the page asks the browser for. Only two kinds are
 * allowed: the page itself, and "blob:" links, which point at files the
 * user picked from their own disk.
 *
 * (Every other test in this folder repeats the same two checks when it
 * finishes: no errors, nothing fetched from the network.)
 */

const { test, expect, PAGE_URL, isLocalRequest, loadPair, seek, report } = require('./support/app');
const { barcode } = require('./support/clips');

test.describe('Opening the page', () => {
  test('starts with no errors and fetches nothing but itself', async ({ page, requests, pageProblems }) => {
    await expect(page).toHaveTitle('Apples to Oranges');
    await expect(page.locator('#empty')).toBeVisible();  // the "Drop your two videos here" box
    await expect(page.locator('#fatal')).toBeHidden();   // the "WebGL is not available" message
    await page.waitForTimeout(500);                      // give a late error or request time to appear
    expect(pageProblems).toEqual([]);
    expect(requests).toEqual([PAGE_URL]);
  });

  test('offers the hook the other tests rely on', async ({ page }) => {
    const names = await page.evaluate(() => Object.keys(window.__a2o));
    expect(names).toEqual(expect.arrayContaining(
      ['S', 'seekAll', 'play', 'pause', 'step', 'setMode', 'zoomAt', 'fitNow', 'oneToOne', 'handleFiles', 'fpsOf']));
  });

  test('loading, seeking and playing two videos stays on the computer', async ({ page, requests, pageProblems }) => {
    await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
    await seek(page, 40);
    await page.click('#playBtn'); // play for a moment, then pause
    await page.waitForTimeout(600);
    await page.click('#playBtn');
    expect((await report(page)).frame).toBeGreaterThan(40);
    for (const mode of ['wipe', 'diff', 'sbs']) await page.click('#mode-' + mode);
    await page.waitForTimeout(300);

    expect(pageProblems).toEqual([]);
    expect(requests.filter((url) => !isLocalRequest(url))).toEqual([]);
    // Each of the two videos was read through its own blob: link.
    const blobLinks = new Set(requests.filter((url) => url.startsWith('blob:')));
    expect(blobLinks.size).toBe(2);
  });
});
