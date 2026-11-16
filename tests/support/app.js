'use strict';

/*
 * Shared helpers for every test file.
 *
 * - `test` opens index.html before each test, exactly the way a double-click
 *   would (a file:// address, no web server). After each test it fails the
 *   test if the page reported an error or contacted anything on the network.
 * - The functions below load clips, move through them, and read back which
 *   frame each video is showing.
 */

const path = require('path');
const { pathToFileURL } = require('url');
const base = require('@playwright/test');

const expect = base.expect;
const PAGE_URL = pathToFileURL(path.join(__dirname, '..', '..', 'index.html')).href;

// The only addresses the page may ever ask for: itself, and "blob:" links.
// A blob: link points at a file the user picked from their own disk. It
// never leaves the computer.
const isLocalRequest = (url) => url === PAGE_URL || url.startsWith('blob:');

/* ---------------------------------------------------------------------
   Code that runs inside the page. It is installed as `window.__t` before
   the page's own script starts, and it talks to the page through the
   `window.__a2o` test hook that index.html provides.
   --------------------------------------------------------------------- */
function installPageHelpers() {
  const T = (window.__t = {});
  const app = () => window.__a2o;
  const loaded = () => app().S.slots.filter((s) => s.file);

  // Resolves at the next screen refresh, just after the page has drawn.
  T.nextRefresh = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  // True once every loaded video has opened, has had its frame rate
  // measured, has finished jumping to its frame, and that frame has been
  // drawn. Until then the picture may still belong to an older position.
  T.settled = () => {
    const slots = loaded();
    return slots.length > 0 && slots.every((s) =>
      s.ready && !s.detecting && !s.video.seeking && s.pendingSeek === null && s.dirty === 0);
  };

  T.whenSettled = async (timeoutMs = 20000) => {
    const start = performance.now();
    while (!T.settled()) {
      if (performance.now() - start > timeoutMs) {
        const state = app().S.slots.map((s) => ({
          file: s.file ? s.file.name : null, ready: s.ready, error: s.error, detecting: s.detecting,
          seeking: s.video.seeking, pendingSeek: s.pendingSeek, dirty: s.dirty,
        }));
        throw new Error('The videos did not settle within ' + timeoutMs + ' ms: ' + JSON.stringify(state));
      }
      await T.nextRefresh();
    }
  };

  // Read the frame number painted on a picture. `pixelAt(x, y)` returns the
  // brightness (0 to 255) at a position given in video pixels. The number is
  // 16 stripes on row 20, each 20 pixels wide, white = 1, lowest bit first.
  // Returns -1 when there is no picture at all, so that an empty (black)
  // picture is never mistaken for frame 0, whose stripes are all black too.
  const decodeStripes = (pixelAt) => {
    let anyPicture = false;
    for (let x = 4; x < 320 && !anyPicture; x += 8) anyPicture = pixelAt(x, 60) > 100;
    if (!anyPicture) return -1;
    let n = 0;
    for (let k = 0; k < 16; k++) if (pixelAt(10 + 20 * k, 20) > 128) n |= 1 << k;
    return n;
  };

  // Which frame is video `i` (0 = Original, 1 = Encoded) showing right now?
  let scratch = null;
  T.frameShown = (i) => {
    const video = app().S.slots[i].video;
    if (!video.videoWidth) return -1;
    if (!scratch) scratch = document.createElement('canvas');
    scratch.width = video.videoWidth;
    scratch.height = video.videoHeight;
    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0);
    const px = ctx.getImageData(0, 0, scratch.width, 64).data;
    return decodeStripes((x, y) => {
      const p = (y * scratch.width + x) * 4;
      return (px[p] + px[p + 1] + px[p + 2]) / 3;
    });
  };
  T.framesShown = () => [T.frameShown(0), T.frameShown(1)];

  // Where things stand once the videos have settled.
  T.report = async () => {
    await T.whenSettled();
    const S = app().S;
    return { shown: T.framesShown(), frame: S.frame, encFrame: S.encFrame, offset: S.offset };
  };

  // Jump to Original frame n while paused, then report what is showing.
  T.seek = async (n) => {
    app().seekAll(n);
    return T.report();
  };

  // Scrub: ask for many positions in quick succession, the way dragging the
  // slider does. `gapMs` is the pause between two requests (0 = none at all).
  T.scrub = async (targets, gapMs) => {
    for (const n of targets) {
      app().seekAll(n);
      if (gapMs) await new Promise((resolve) => setTimeout(resolve, gapMs));
    }
    return T.report();
  };

  // The same, but through the real slider on the page.
  T.dragSlider = async (targets, gapMs) => {
    const slider = document.getElementById('scrub');
    slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    for (const n of targets) {
      slider.value = String(n);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      if (gapMs) await new Promise((resolve) => setTimeout(resolve, gapMs));
    }
    slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    return T.report();
  };

  /* ----- Reading the picture the page actually draws (the WebGL view) ----- */

  // The page's own drawing surface. Asking for it again returns the one the
  // page already made.
  const drawingOf = (view) => view.getContext('webgl2') || view.getContext('webgl');

  // Run `read` during the next screen refresh, right after the page has
  // drawn its view. The page clears its drawing once a refresh is over, so
  // this is the only moment it can be read. `needsRender` asks the page to
  // draw even if nothing changed.
  T.afterDraw = (read) => new Promise((resolve, reject) => {
    app().S.needsRender = true;
    requestAnimationFrame(() => {
      try { resolve(read()); } catch (err) { reject(err); }
    });
  });

  // Where the picture sits inside the drawn view, in view pixels. In "Side
  // by side", pane 0 is the Original and pane 1 the Encoded video.
  T.pictureBox = (pane) => {
    const S = app().S;
    const view = document.getElementById('gl');
    const size = S.slots[0].ready ? S.slots[0] : S.slots[1];
    let left = 0, top = 0;
    if (S.mode === 'sbs' && pane === 1) {
      if (S.lastPane.w < view.width) left = view.width - S.lastPane.w; // panes left and right
      else top = view.height - S.lastPane.h;                           // panes above and below
    }
    return { left: left + S.view.tx, top: top + S.view.ty, scale: S.view.s, w: size.w, h: size.h };
  };

  // Which frame number is drawn in a pane of the Side by side view? Only
  // valid inside T.afterDraw (see above).
  T.frameDrawn = (pane) => {
    const view = document.getElementById('gl');
    const gl = drawingOf(view);
    const box = T.pictureBox(pane);
    const rows = new Map(); // each row of the view is fetched once
    return decodeStripes((x, y) => {
      const vx = Math.floor(box.left + (x + 0.5) * box.scale), vy = Math.floor(box.top + (y + 0.5) * box.scale);
      if (vx < 0 || vy < 0 || vx >= view.width || vy >= view.height) return 0;
      let row = rows.get(vy);
      if (!row) {
        row = new Uint8Array(view.width * 4);
        gl.readPixels(0, view.height - 1 - vy, view.width, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
        rows.set(vy, row);
      }
      return (row[vx * 4] + row[vx * 4 + 1] + row[vx * 4 + 2]) / 3;
    });
  };

  T.framesDrawn = async () => {
    await T.whenSettled();
    return T.afterDraw(() => [T.frameDrawn(0), T.frameDrawn(1)]);
  };

  // Difference view: how bright is the picture? Looks at every third pixel
  // of the picture area and reports the brightest value found (0 to 255)
  // and the share of pixels that are clearly lit.
  T.differenceBrightness = async () => {
    await T.whenSettled();
    return T.afterDraw(() => {
      const view = document.getElementById('gl');
      const gl = drawingOf(view);
      const box = T.pictureBox(0);
      const x0 = Math.max(0, Math.ceil(box.left) + 2), x1 = Math.min(view.width, Math.floor(box.left + box.w * box.scale) - 2);
      const y0 = Math.max(0, Math.ceil(box.top) + 2), y1 = Math.min(view.height, Math.floor(box.top + box.h * box.scale) - 2);
      const w = x1 - x0, h = y1 - y0;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(x0, view.height - y1, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let samples = 0, lit = 0, brightest = 0;
      for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 3) {
          const p = (y * w + x) * 4;
          const v = Math.max(px[p], px[p + 1], px[p + 2]);
          samples++;
          if (v > 40) lit++;
          if (v > brightest) brightest = v;
        }
      }
      return { samples, brightest, litShare: samples ? lit / samples : 0 };
    });
  };

  // How many canvas pixels inside the picture are brighter than `level`
  // (0 to 255), counting every pixel.
  T.litPixels = async (level) => {
    await T.whenSettled();
    return T.afterDraw(() => {
      const view = document.getElementById('gl');
      const gl = drawingOf(view);
      const box = T.pictureBox(0);
      const x0 = Math.max(0, Math.floor(box.left)), x1 = Math.min(view.width, Math.ceil(box.left + box.w * box.scale));
      const y0 = Math.max(0, Math.floor(box.top)), y1 = Math.min(view.height, Math.ceil(box.top + box.h * box.scale));
      const w = x1 - x0, h = y1 - y0;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(x0, view.height - y1, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let lit = 0;
      for (let p = 0; p < px.length; p += 4) if (Math.max(px[p], px[p + 1], px[p + 2]) > level) lit++;
      return { lit, total: w * h, zoom: box.scale };
    });
  };

  // Play until the Original has reached frame `target` (or a later one),
  // pause, and resolve with the frame that was on screen at that moment.
  //
  // "On screen" is taken literally: it is the frame number read from the
  // view the page draws, not from the hidden video player, which is often a
  // frame ahead of the drawing. To be certain, this waits until the view has
  // shown the same frame on two screen refreshes in a row and the player
  // agrees with it. That needs slow motion: at full speed a 60 fps video
  // changes on every refresh. The caller picks the speed.
  T.playThenPauseAt = (target, timeoutMs = 30000) => new Promise((resolve, reject) => {
    const a = app();
    const start = performance.now();
    let previous = -1;
    const eachRefresh = () => {
      if (!a.S.playing) { reject(new Error('Playback stopped before frame ' + target)); return; }
      if (performance.now() - start > timeoutMs) { a.pause(); reject(new Error('Playback never settled on frame ' + target + ' or later')); return; }
      const drawn = T.frameDrawn(0);
      if (drawn >= target && drawn === previous && drawn === T.frameShown(0)) { a.pause(); resolve(drawn); return; }
      previous = drawn;
      a.S.needsRender = true;
      requestAnimationFrame(eachRefresh);
    };
    a.play();
    a.S.needsRender = true;
    requestAnimationFrame(eachRefresh);
  });
}

/* ---------------------------------------------------------------------
   Helpers that run on the test side
   --------------------------------------------------------------------- */

const test = base.test.extend({
  // Everything the page asked the browser to fetch during the test.
  requests: async ({}, use) => { await use([]); },

  // Errors the page reported: failed scripts and console error messages.
  pageProblems: async ({}, use) => { await use([]); },

  page: async ({ page, requests, pageProblems }, use) => {
    page.on('request', (request) => requests.push(request.url()));
    page.on('pageerror', (error) => pageProblems.push('Uncaught error: ' + error.message));
    page.on('console', (message) => { if (message.type() === 'error') pageProblems.push('Console error: ' + message.text()); });
    await page.addInitScript(installPageHelpers);
    await page.goto(PAGE_URL);
    await use(page);
    expect(pageProblems, 'the page reported errors').toEqual([]);
    expect(requests.filter((url) => !isLocalRequest(url)), 'the page contacted the network').toEqual([]);
  },
});

// Put a clip in a slot (0 = Original, 1 = Encoded) through the page's own
// file picker. `file` is a path on disk, or { name, mimeType, buffer }.
async function loadSlot(page, slot, file) {
  await page.setInputFiles('#file' + slot, file);
}

// Load both clips and wait until both are ready to compare.
async function loadPair(page, original, encoded) {
  await loadSlot(page, 0, original.path);
  await loadSlot(page, 1, encoded.path);
  await settle(page);
}

const settle = (page) => page.evaluate(() => window.__t.whenSettled());
const report = (page) => page.evaluate(() => window.__t.report());
const seek = (page, n) => page.evaluate((frame) => window.__t.seek(frame), n);

// Which Encoded frame belongs with Original frame n: the Encoded frame that
// is showing at the middle of the Original frame's time on screen, shifted
// by the encode offset and kept inside the clip.
//
// The middle of Original frame n is at (n + 0.5) / originalFps seconds, and
// the Encoded frame showing then is that time multiplied by encodedFps,
// rounded down. Frame rates are fractions (23.976 is 24000/1001), so this is
// worked out in whole numbers to keep rounding errors out of the answer.
function matchingEncodedFrame(n, original, encoded, offset = 0) {
  const a = original.rate, b = encoded.rate;
  const m = Math.floor(((2 * n + 1) * a.den * b.num) / (2 * a.num * b.den)) + offset;
  return Math.min(encoded.frames - 1, Math.max(0, m));
}

// Compare what both videos show with what they should show. Mistakes are
// collected instead of stopping at the first one, so a failing run lists
// every wrong frame at once.
function checkFrames(mistakes, when, result, wantOriginal, wantEncoded) {
  const [original, encoded] = result.shown;
  if (original === wantOriginal && encoded === wantEncoded) return;
  mistakes.push(when + ': Original shows frame ' + original + ' (should be ' + wantOriginal +
    '), Encoded shows frame ' + encoded + ' (should be ' + wantEncoded + ')');
}

// A small repeatable random number generator. The same seed always gives
// the same "random" frames, so a failure can be reproduced exactly.
function randomSource(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randomFrame = (random, clip) => Math.floor(random() * clip.frames);

module.exports = {
  test, expect, PAGE_URL, isLocalRequest,
  loadSlot, loadPair, settle, report, seek,
  matchingEncodedFrame, checkFrames, randomSource, randomFrame,
};
