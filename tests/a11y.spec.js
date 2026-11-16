'use strict';

/*
 * 12. Keyboard use, accessibility and the page's security policy.
 */

const { test, expect, loadPair, report } = require('./support/app');
const { barcode } = require('./support/clips');

test('Space presses the focused button instead of playing', async ({ page }) => {
  await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
  await page.focus('#helpBtn');
  await page.keyboard.press(' ');
  await expect(page.locator('#helpModal')).toHaveClass(/open/);
  expect(await page.evaluate(() => window.__a2o.S.playing)).toBe(false);
});

test('arrow keys move a focused slider instead of stepping frames', async ({ page }) => {
  await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
  await page.click('#mode-diff');
  const before = await page.locator('#boost').inputValue();
  await page.focus('#boost');
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('#boost').inputValue()).not.toBe(before);
  expect((await report(page)).frame, 'frame did not change').toBe(0);
});

test('pop-ups take focus, keep Tab inside, and give focus back', async ({ page }) => {
  await page.focus('#codecBtn');
  await page.keyboard.press('Enter');
  const modal = page.locator('#codecModal');
  await expect(modal).toHaveClass(/open/);
  const inside = () => page.evaluate(() => document.getElementById('codecModal').contains(document.activeElement));
  expect(await inside(), 'focus moved into the pop-up').toBe(true);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    expect(await inside(), 'focus stays inside after Tab ' + (i + 1)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.activeElement.id)).toBe('codecBtn');
});

test('each file box has a Choose button that works from the keyboard', async ({ page }) => {
  // Watch the hidden file input instead of waiting for Playwright's
  // "filechooser" event: that event depends on Playwright switching on file
  // dialog interception in time, and missed about 1 in 10 dialogs in testing
  // even though the page had opened them.
  await page.evaluate(() => {
    window.__opened = [];
    const input = document.getElementById('file0');
    input.click = () => window.__opened.push(navigator.userActivation.isActive);
  });
  await page.focus('#slot0 button.pick');
  await page.keyboard.press('Enter');
  await page.keyboard.press(' ');
  // Opened once per key, each time as a genuine user action (browsers only
  // show a file dialog for those).
  expect(await page.evaluate(() => window.__opened)).toEqual([true, true]);
});

test('a file box is not rebuilt when nothing in it changed', async ({ page }) => {
  await loadPair(page, barcode['30'].mp4, barcode['30'].webm);
  // An open Frame rate menu closes if its box is rebuilt, so the menu must
  // be the very same element after a refresh with no changes.
  const same = await page.evaluate(() => {
    const before = document.querySelector('#fps0');
    // Re-pick the option that is already chosen. The page redraws both
    // file boxes, with nothing in them changed.
    before.dispatchEvent(new Event('change', { bubbles: true }));
    return new Promise((resolve) => setTimeout(() => resolve(document.querySelector('#fps0') === before), 300));
  });
  expect(same).toBe(true);
});

test('the security policy blocks network requests', async ({ page, pageProblems }) => {
  const result = await page.evaluate(() => fetch('https://example.com/').then(() => 'loaded', () => 'blocked'));
  expect(result).toBe('blocked');
  // The browser reports the blocked request as a console error, which is the
  // point of this test, so don't count it as a page problem.
  const csp = pageProblems.filter((p) => /Content Security Policy/i.test(p));
  expect(csp.length).toBeGreaterThan(0);
  pageProblems.length = 0;
});
