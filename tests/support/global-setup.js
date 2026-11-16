'use strict';

/*
 * Runs once before the tests: makes the test clips with ffmpeg.
 *
 * Clips are kept in tests/.media/ between runs. A clip is only made again
 * when it is missing or when its recipe in clips.js has changed, so the
 * second run starts much faster than the first.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { MEDIA_DIR, allClips } = require('./clips');

const NEEDED_ENCODERS = ['libvpx-vp9', 'libx264', 'libx265'];

function ffmpeg(args) {
  return execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function checkFfmpeg() {
  let encoders;
  try {
    encoders = ffmpeg(['-encoders']);
  } catch (err) {
    throw new Error(
      'The tests need ffmpeg to make their test videos, and it could not be run.\n' +
      'Install it first (Ubuntu: "sudo apt-get install ffmpeg", macOS: "brew install ffmpeg").\n' +
      'Original error: ' + err.message
    );
  }
  const missing = NEEDED_ENCODERS.filter((name) => !new RegExp('\\s' + name + '\\s').test(encoders));
  if (missing.length) {
    throw new Error(
      'This ffmpeg cannot encode with: ' + missing.join(', ') + '.\n' +
      'The tests need all of ' + NEEDED_ENCODERS.join(', ') + '. Install a full ffmpeg build.'
    );
  }
}

module.exports = async function globalSetup() {
  checkFfmpeg();
  fs.mkdirSync(MEDIA_DIR, { recursive: true });

  const manifestPath = path.join(MEDIA_DIR, 'manifest.json');
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (err) { /* first run */ }

  let made = 0;
  for (const clip of allClips) {
    const recipe = clip.args.join(' ');
    const upToDate = manifest[clip.file] === recipe && fs.existsSync(clip.path) && fs.statSync(clip.path).size > 0;
    if (upToDate) continue;
    try {
      ffmpeg(['-y', ...clip.args, clip.path]);
    } catch (err) {
      throw new Error('ffmpeg could not make the test clip ' + clip.file + ':\n' + (err.stderr || err.message));
    }
    manifest[clip.file] = recipe;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    made++;
  }
  if (made) console.log('Made ' + made + ' test clip(s) in ' + path.relative(process.cwd(), MEDIA_DIR) + '/');
};
