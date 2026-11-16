# Apples to Oranges

Compare an original video with an encoded (compressed) copy of it, frame by frame, in your web browser.

**Use it online: https://crab-krab.github.io/apples-to-oranges/**

It is a single web page (`index.html`). There is nothing to install and no account to make. **Your videos never leave your computer.** The page opens them directly from your disk and uploads nothing.

## What it does

- Shows the **Original** and the **Encoded** video in three ways:
  1. **Side by side.** Two panels, Original on the left (or top) and Encoded on the right (or bottom).
  2. **Wipe.** Both videos stacked on top of each other, with a divider you drag to reveal one or the other.
  3. **Difference.** Lights up the pixels that changed between the two. Unchanged pixels stay black.
- Keeps both videos on **exactly the same frame** whenever playback is paused, while stepping or while scrubbing.
- Keeps them **in sync while playing**. The Original sets the pace and the Encoded follows it.
- Lets you **zoom in to individual pixels** and pan around. Every view zooms and pans together.
- Shows each file's **resolution, frame rate, length, file size and codec**, and **warns you** when the two files don't match.

## How to use it

### Open the tool

- **On your own computer:** download `index.html` and double-click it. It opens in your default browser.
- **Online:** visit https://crab-krab.github.io/apples-to-oranges/

### Load your videos

- Click the **Original** or **Encoded** box at the top to pick a file, or drag a file onto it.
- You can also drop **both files at once** anywhere on the page. The tool guesses that the **larger file is the Original**, because encoding usually makes files smaller. If it guessed wrong, click **⇄ Swap**.
- Dropping a single file somewhere other than a box fills whichever slot is empty. If both slots are full, it replaces the Encoded video. This makes it quick to compare several encodes against the same original.

### Read the warnings

A yellow bar appears under the file boxes when the two files differ in:

- **Resolution** (the picture's width × height in pixels). A smaller encode is scaled up to the Original's size, so the two can be compared pixel for pixel.
- **Aspect ratio** (the picture's shape, e.g. 16:9). The encode is stretched to fit, so shapes in it will look distorted.
- **Frame rate** (frames per second, "fps"). Frames can't pair up one-to-one, so the encode shows whichever of its frames would be on screen at that moment.
- **Duration** (length). This can mean frames were dropped or added at the start or end.

### Play, pause, step and scrub

- **▶ / ❚❚** plays and pauses both videos together.
- The **step buttons** move one frame or ten frames at a time.
- The **scrub bar** (the long slider) jumps anywhere in the video. Both videos land on the same frame.
- The readout shows the **timestamp** and **frame number** of the Original, plus the matching **Encoded frame**. Frame numbers start at 0, like ffmpeg.
- **Speed** can be 0.1×, 0.25×, 0.5×, 1×, 1.5× or 2×.
- **Sound on / Muted** controls the Original's audio. The Encoded video is always silent, so you never hear the same sound twice.

### Line the videos up (Encode offset)

Sometimes an encode has an extra or a missing frame at the start, so everything is shifted by one or more frames. Use **Encode offset − / +** (or the `[` and `]` keys) to shift the Encoded video earlier or later by whole frames until the pictures match. Click the number to reset it to 0.

### Frame rate

Browsers don't tell web pages a video's frame rate. So when a file loads, the tool quietly plays a hidden, muted copy for a moment, records when each frame appears, and works out the rate from that. The result is rounded to the nearest standard rate (23.976, 24, 25, 29.97, 30, 50, 59.94, 60 and so on).

If the guess is wrong, or the tool couldn't measure it, pick the correct rate from that file's **Frame rate** menu. Choose **Custom…** to type any number.

### Zoom and pan

| Action | What it does |
| --- | --- |
| Scroll wheel (or trackpad pinch) | Zoom in or out toward the mouse pointer |
| Drag | Move (pan) the picture |
| Double-click | Switch between "Fit" and 1:1 at that spot |
| **Fit** button | Fit the whole picture in the window |
| **1:1** button | Actual pixels: one video pixel per screen pixel |

When you zoom in far enough to see individual pixels, they are drawn as sharp squares instead of being smoothed. This is called "nearest-neighbor" scaling, and it lets you see exactly what each pixel contains.

"1:1" means one video pixel per *physical* screen pixel. On high-resolution screens (such as Retina displays) that looks smaller than you might expect, because those screens pack more pixels into each inch.

### Difference view options

- **Boost** multiplies small differences so you can see them. At ×1, only big changes show. At ×8 (the default) or higher, even tiny compression errors light up.
- **Heatmap:** black means no change. Purple, red, orange, yellow and white mean bigger and bigger changes.
- **Grayscale:** brighter means a bigger change.
- **Per-channel (RGB):** shows the red, green and blue differences separately. A pure red speck means only the red part of that pixel changed.

When zoomed in to 100% or more, the difference is calculated for each Original pixel, so the result doesn't change as you zoom.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Back / forward one frame |
| `Shift` + `←` / `→` | Back / forward ten frames |
| `1` / `2` / `3` | Side by side / Wipe / Difference |
| `[` / `]` | Shift the Encoded video one frame earlier / later |
| `0` | Fit to window |
| `Z` | 1:1 actual pixels |
| `+` / `-` | Zoom in / out |
| `M` | Mute / unmute the Original's audio |
| `?` | Show / hide the shortcut list |
| `Esc` | Close a pop-up window |

## Browser and codec support

A **codec** is the method used to compress a video, for example H.264 or AV1. To show the picture, the browser must understand that method. Which codecs a browser can play depends on the browser, the operating system and sometimes the graphics hardware, so the same file can play on one computer and fail on another.

When a file can't be played, the tool says so and opens a **Codecs** window. For H.264 and HEVC files it also names the profile (the feature set the encoder used) and the bit depth, and explains when that is the likely reason, for example 10-bit H.264 in Firefox. That window shows what *your* browser reports it can play, which is the most reliable answer for your machine. You can open it at any time with the **Codecs** button.

General picture (checked against caniuse.com's published data, November 2026; check the links for current details):

| Codec | Usually works in |
| --- | --- |
| **H.264 (AVC)** | All current versions of Chrome, Edge, Firefox, Safari and Opera. Some Linux builds of Chromium and Firefox leave it out for licensing reasons. 10-bit H.264 and H.264 with 4:2:2 or 4:4:4 color (common in anime fan releases and camera footage) are a different story: Firefox and Safari hand H.264 to the operating system's decoder, which often can't play them, while Chrome, Edge and Opera usually decode them on their own. |
| **HEVC (H.265)** | Safari on macOS and iOS. Chrome and Edge on macOS and Android. On Windows, Chrome and Edge need graphics hardware that can decode HEVC, and Edge also needs Microsoft's HEVC Video Extensions from the Microsoft Store. Firefox 137 or newer when the graphics hardware can decode HEVC. On Linux and ChromeOS only Chrome with working hardware decoding, so it is often missing there. |
| **AV1** | Chrome, Firefox, Opera and Edge 121 or newer. Safari only on Apple devices with a hardware AV1 decoder (for example Macs with M3 chips or newer, iPhone 15 Pro or newer). |
| **VP9** | Chrome, Edge, Firefox and Opera. Safari 16 or newer on Mac, and Safari on iPhone and iPad from iOS 17.4. Safari does not support transparency (alpha) in WebM video. |

Up-to-date tables: [HEVC](https://caniuse.com/hevc) · [AV1](https://caniuse.com/av1) · [WebM / VP9](https://caniuse.com/webm) · [MP4 / H.264](https://caniuse.com/mpeg4)

**Tip:** if an HEVC file won't play, try Safari on a Mac, or Chrome or Edge on Windows.

**Containers** (the file "wrapper": `.mp4`, `.mov`, `.webm`, `.mkv`) also matter. MP4 and WebM work almost everywhere. MOV usually works when the codec inside is supported. MKV works in Chrome, Edge and Firefox 145 or newer when it holds a common codec (H.264, HEVC, VP8, VP9 or AV1). Support elsewhere, such as Safari, is patchy.

**Other requirements:** the page draws the videos with **WebGL** (the browser's built-in way to use the graphics card). Every current desktop browser has it. If it's missing, check that "hardware acceleration" is turned on in your browser settings.

The automatic frame-rate measurement uses a browser feature called `requestVideoFrameCallback`. Current Chrome, Edge, Safari and Firefox have it. On a browser without it, the tool assumes 30 fps and asks you to set the correct rate yourself.

## Things to know about accuracy

- **What you see is the browser's decoding.** The browser converts the video's colors to normal screen colors. HDR and 10-bit videos are reduced to the browser's standard 8-bit output, so very subtle differences in HDR material may not show.
- **A smaller encode is upscaled with simple smoothing (bilinear).** Video players often use sharper upscaling, so some of the difference you see in that case comes from the upscaling itself, not just the compression.
- **Jumping to a frame can take a moment** with some files, especially high-quality originals that have few "keyframes". A keyframe is a complete picture the decoder can start from, and other frames must be rebuilt from the nearest one. A small **"Decoding…"** badge appears in the bottom-left corner until both pictures are ready.
- **Variable frame rate** videos (common from phones and screen recorders) have no single frame rate. Frame numbers are then approximate, but pausing still shows the two videos at the same moment.
- **Frame numbers depend on the frame rate.** The tool measures each file's rate by briefly playing it. If the reading is wrong (you'll see a "Frame rates differ" warning between two files you know match, for example), pick the correct rate in that file's **Frame rate** menu.
- **Damaged or cut-off files** can show the last picture the browser could decode under a later frame number. The same can happen when a file's audio runs longer than its video.
- **"1:1" is exact in Chrome and Edge.** Browsers that don't report the screen area's exact pixel size, possibly Safari, fall back to an estimate. At some window sizes that can be one pixel off, which softens the 1:1 view slightly.
- **Tested mainly in Chromium.** Automated tests run in Chromium only. Firefox and Safari use different video decoders and timing, so frame accuracy there is less thoroughly checked.

## Publishing it on GitHub Pages

GitHub Pages is GitHub's free website hosting. It turns this repository into a public web page.

1. Create a new repository on GitHub and upload these files (or push this git repository to it).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the **main** branch and the **/ (root)** folder, then click **Save**.
5. After a minute or two, the page will be live at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

Official guide: [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Even when hosted online, videos are still opened only on the visitor's own computer. GitHub never receives them.

## How it works (for the curious)

- Each file is opened with `URL.createObjectURL`, which gives the page a private link to the file on your disk.
- Two hidden `<video>` elements decode the files. Each new frame is copied to the graphics card, and one small WebGL program draws all three views, so every view uses the same zoom, pan and colors.
- To land on an exact frame, the tool seeks to the **middle** of that frame's time slot. Seeking to its exact start could land on the previous frame because of rounding.
- While you scrub, the tool remembers only the latest position you asked for. It jumps there once the previous jump finishes, so the slider stays responsive.
- During playback, the Encoded video's speed is nudged up to 12% faster or slower to close small timing gaps. It only jumps when it drifts by more than about 0.3 seconds.

## Running the tests

The `tests/` folder holds automated checks. They open `index.html` in a real browser (headless Chromium, driven by [Playwright](https://playwright.dev)) and confirm that it shows the right frames. Nothing in that folder is needed to use the tool. `index.html` still works on its own.

You need [Node.js](https://nodejs.org) 20 or newer and [ffmpeg](https://ffmpeg.org) with the `libvpx-vp9`, `libx264` and `libx265` encoders (standard builds include them).

```bash
cd tests
npm ci
npx playwright install chromium
npm test
```

On Linux, use `npx playwright install --with-deps chromium` if the browser is missing system libraries.

- **No videos are stored in the repository.** The first run makes its test clips with ffmpeg and keeps them in `tests/.media/`. Every frame of a clip has its own frame number painted on it as a row of black and white stripes, so a test can read back exactly which frame is on screen.
- **What is checked:** the page loads without errors and contacts nothing on the network, paused frame accuracy (random jumps, single steps, rapid scrubbing, encode offset), frame-rate detection (including 240 fps), pausing (in slow motion and at full speed), that the frame counter matches the picture during 60 fps playback, the Difference view (including that no changed pixel is missed when zoomed out), that the 1:1 view is pixel-exact (at 100% and 150% screen scaling), codec labels, and that a hostile file name is shown as plain text.
- **Changing the tool:** keep `index.html` a single self-contained file (no libraries, no build step), so it still works when double-clicked. Run the tests before and after a change.
- GitHub runs the same tests on every push and pull request (see `.github/workflows/test.yml`).

## License

Copyright (C) 2026 Crab-Krab.

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License, version 3** (or, at your option, any later version), as published by the Free Software Foundation. See [`LICENSE`](LICENSE) for the full text.

In plain terms: anyone may use, study, change and share this tool. If they share a modified version, they must release their changes under the same license, with the source code available. It comes with no warranty.
