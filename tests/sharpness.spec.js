'use strict';

/*
 * 7. The 1:1 view is pixel-exact.
 *
 * At 1:1 (one video pixel per screen pixel) the page must not let the
 * browser rescale the picture. The test clip is a lossless checkerboard of
 * single black and white pixels. A screenshot of it at 1:1 must contain
 * only pure black and pure white. Any grey means the picture was blurred.
 *
 * Two bugs used to cause grey here (found by an audit):
 * - The drawing surface was sized from a rounded CSS height, so it was often
 *   one row taller or shorter than the screen area it filled.
 * - After switching view or dragging, the pan could land on half a pixel.
 *
 * The screenshot is taken by the browser, so it shows what reaches the
 * screen, including any rescaling the browser does itself.
 */

const { sharpnessTests } = require('./support/sharpness');

// Window sizes where the audit saw the blur, at normal (100%) scaling.
// sharpness-150.spec.js repeats the checks at 150% scaling.
sharpnessTests([
  { width: 1366, height: 768, scale: 1 },
  { width: 1440, height: 813, scale: 1 },
]);
