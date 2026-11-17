'use strict';

/*
 * The list of test clips.
 *
 * No video is stored in the repository. Every clip below is made with ffmpeg
 * when the tests start (see global-setup.js) and saved in tests/.media/,
 * which git ignores.
 *
 * Two kinds of clip are made:
 *
 * 1. "Barcode" clips. Each frame carries its own frame number as a row of 16
 *    black or white stripes along the top of the picture, so a test can look
 *    at a decoded picture and read back exactly which frame it is.
 *
 * 2. Tiny "codec" clips in H.264 and HEVC. Only their headers matter. They
 *    check the codec label the page shows, and are never required to play.
 */

const path = require('path');

const MEDIA_DIR = path.join(__dirname, '..', '.media');

// ffmpeg filter that paints the frame number on the top 40 rows. Stripe k
// (20 pixels wide, counted from the left) is white when bit k of the frame
// number is 1. The two colour planes are set to neutral grey there, so the
// stripes are pure black and white.
const BARCODE_FILTER =
  "geq=lum='if(lt(Y,40),255*mod(floor(N/pow(2,floor(X/20))),2),lum(X,Y))'" +
  ":cb='if(lt(Y/SH,40),128,cb(X,Y))'" +
  ":cr='if(lt(Y/SH,40),128,cr(X,Y))'";

const SECONDS = 5;

// Frame rates as exact fractions: 23.976 fps is really 24000/1001.
const RATES = [
  { label: '23.976', num: 24000, den: 1001 },
  { label: '30', num: 30, den: 1 },
  { label: '60', num: 60, den: 1 },
].map((rate) => ({ ...rate, fps: rate.num / rate.den }));

// MP4 stores frame times exactly. WebM rounds them to whole milliseconds,
// which is what trips up the pause bug described in pause.spec.js.
const CONTAINERS = [
  { ext: 'mp4', label: 'MP4' },
  { ext: 'webm', label: 'WebM' },
];

function barcodeClip(rate, container, { name, crf = 30 } = {}) {
  const frames = Math.round(rate.fps * SECONDS);
  const file = (name || 'barcode-' + rate.label + 'fps') + '.' + container.ext;
  return {
    file,
    path: path.join(MEDIA_DIR, file),
    title: rate.label + ' fps ' + container.label,
    container: container.ext,
    rate,
    fps: rate.fps,
    frames,
    args: [
      '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=' + rate.num + '/' + rate.den,
      '-vf', BARCODE_FILTER,
      '-frames:v', String(frames),
      // VP9 plays in every Chromium build, including ones without H.264.
      // A keyframe only every 48 frames makes seeking do real work.
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '0', '-crf', String(crf),
      '-g', '48', '-deadline', 'good', '-cpu-used', '5', '-row-mt', '1', '-an',
    ],
  };
}

// barcode['30'].mp4, barcode['23.976'].webm, and so on.
const barcode = {};
for (const rate of RATES) {
  barcode[rate.label] = {};
  for (const container of CONTAINERS) barcode[rate.label][container.ext] = barcodeClip(rate, container);
}

// The same 30 fps pictures squeezed as hard as VP9 allows, for the
// Difference view test. It looks visibly worse than the normal clip.
const lossy = barcodeClip(RATES[1], CONTAINERS[1], { name: 'barcode-30fps-lossy', crf: 63 });
lossy.title = '30 fps WebM, heavily compressed';

function codecClip(file, encoder, extra, label, hint) {
  return {
    file,
    path: path.join(MEDIA_DIR, file),
    label,       // what the page should show next to the file
    hint,        // true when the page should also explain why it may not play
    args: [
      '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30', '-frames:v', '12',
      '-c:v', encoder, ...extra, '-an',
    ],
  };
}

const X264 = ['-preset', 'veryfast'];
const X265 = ['-preset', 'ultrafast', '-x265-params', 'log-level=error'];

// [file name without extension, encoder, encoder options, expected label, expect a hint]
const CODEC_RECIPES = [
  ['h264-baseline', 'libx264', [...X264, '-profile:v', 'baseline', '-pix_fmt', 'yuv420p'], 'H.264 (Baseline, 8-bit)', false],
  ['h264-main', 'libx264', [...X264, '-profile:v', 'main', '-pix_fmt', 'yuv420p'], 'H.264 (Main, 8-bit)', false],
  ['h264-high-8bit', 'libx264', [...X264, '-profile:v', 'high', '-pix_fmt', 'yuv420p'], 'H.264 (High, 8-bit)', false],
  ['h264-high10-10bit', 'libx264', [...X264, '-pix_fmt', 'yuv420p10le'], 'H.264 (High 10, 10-bit)', true],
  ['h264-422-8bit', 'libx264', [...X264, '-pix_fmt', 'yuv422p'], 'H.264 (High 4:2:2, 8-bit, 4:2:2)', true],
  ['h264-422-10bit', 'libx264', [...X264, '-pix_fmt', 'yuv422p10le'], 'H.264 (High 4:2:2, 10-bit, 4:2:2)', true],
  ['h264-444-8bit', 'libx264', [...X264, '-pix_fmt', 'yuv444p'], 'H.264 (High 4:4:4, 8-bit, 4:4:4)', true],
  ['hevc-main-8bit', 'libx265', [...X265, '-pix_fmt', 'yuv420p'], 'HEVC (Main, 8-bit)', false],
  ['hevc-main10-10bit', 'libx265', [...X265, '-pix_fmt', 'yuv420p10le'], 'HEVC (Main 10, 10-bit)', false],
  ['hevc-422-10bit', 'libx265', [...X265, '-pix_fmt', 'yuv422p10le'], 'HEVC (Range Extensions, 10-bit, 4:2:2)', true],
];

const codecs = [];
for (const [name, encoder, extra, label, hint] of CODEC_RECIPES) {
  // MP4 marks HEVC with one of two four-letter tags. "hvc1" is the one Apple
  // devices expect, so use it here. ffmpeg's own default, "hev1", is covered
  // by the extra clip below.
  const mp4Extra = encoder === 'libx265' ? [...extra, '-tag:v', 'hvc1'] : extra;
  codecs.push(codecClip(name + '.mp4', encoder, mp4Extra, label, hint));
  codecs.push(codecClip(name + '.mkv', encoder, extra, label, hint));
}
codecs.push(codecClip('hevc-main-8bit-hev1.mp4', 'libx265', [...X265, '-pix_fmt', 'yuv420p', '-tag:v', 'hev1'], 'HEVC (Main, 8-bit)', false));

// A lossless checkerboard of single black and white pixels. Shown at 1:1,
// every screen pixel must be pure black or pure white. Any grey means the
// browser rescaled the picture (see sharpness.spec.js).
const checker = {
  file: 'checker-lossless.webm',
  path: path.join(MEDIA_DIR, 'checker-lossless.webm'),
  title: 'lossless 1-pixel checkerboard',
  container: 'webm',
  rate: RATES[1],
  fps: 30,
  frames: 30,
  args: [
    '-f', 'lavfi', '-i', 'color=c=gray:s=640x360:r=30:d=1',
    '-vf', "geq=lum='255*mod(X+Y,2)':cb=128:cr=128,format=yuv420p",
    '-c:v', 'libvpx-vp9', '-lossless', '1', '-an',
  ],
};

// A 240 fps clip. Played at half speed it still shows 120 frames a second,
// faster than a 60 Hz screen, which used to make it measure as 120 fps.
const fast = barcodeClip({ label: '240', num: 240, den: 1, fps: 240 }, CONTAINERS[0], { name: 'barcode-240fps' });

// Two lossless 1920x1080 pictures, identical except for isolated single
// pixels, one every 16 pixels in each direction (120 x 67 = 8,040 of them).
// Shown zoomed out, every one of them must light up in the Difference view
// (see difference-sampling.spec.js).
const DOT_STEP = 16;
const dotsClip = (name, withDots) => ({
  file: name + '.webm',
  path: path.join(MEDIA_DIR, name + '.webm'),
  title: name,
  container: 'webm',
  rate: RATES[1],
  fps: 30,
  frames: 15,
  args: [
    '-f', 'lavfi', '-i', 'color=c=gray:s=1920x1080:r=30:d=0.5',
    '-vf', (withDots ? "geq=lum='if(eq(mod(X," + DOT_STEP + "),8)*eq(mod(Y," + DOT_STEP + "),8),255,128)'"
                     : "geq=lum='128'") + ':cb=128:cr=128,format=yuv420p',
    '-c:v', 'libvpx-vp9', '-lossless', '1', '-an',
  ],
});
const dots = { plain: dotsClip('dots-none', false), dotted: dotsClip('dots-every-16px', true), step: DOT_STEP, count: 120 * 67 };

// The 30 fps barcode clip, but stored so its first frame starts at 0.021 s
// instead of 0, as MKV files remuxed from DVDs often do. The tool used to
// count frames from 0 s, so it landed one frame early on such files.
const delayed = barcodeClip(RATES[1], CONTAINERS[1], { name: 'barcode-30fps-starts-late' });
delayed.args = [...delayed.args, '-output_ts_offset', '0.021'];
delayed.title = '30 fps WebM starting at 0.021 s';
delayed.start = 0.021;

const allClips = [
  ...RATES.flatMap((rate) => CONTAINERS.map((container) => barcode[rate.label][container.ext])),
  lossy,
  delayed,
  checker,
  fast,
  dots.plain,
  dots.dotted,
  ...codecs,
];

module.exports = { MEDIA_DIR, RATES, CONTAINERS, barcode, lossy, delayed, checker, fast, dots, codecs, allClips };
