/**
 * Generates all app icon assets from SVG definitions.
 * Run: node scripts/generate-icons.js
 * Requires: npm install --save-dev sharp
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets', 'images');
const PRIMARY = '#1A73E8';

// Shuttlecock SVG — feather ring + 9 spines + cork, white on blue rounded-rect
function shuttlecockSvg(size, rounded = true, background = PRIMARY, fgColor = '#FFFFFF') {
  // All coordinates are in a 1024×1024 viewBox.
  // Feather ring: center (512, 300) r=180
  // Cork: ellipse (512, 720) rx=62 ry=52
  // 9 feather spines from (512, 668) fanning to ring at 150°–30° in 30° steps
  const spinePoints = [
    [356, 390], [332, 300], [356, 210],
    [422, 144], [512, 120], [602, 144],
    [668, 210], [692, 300], [668, 390],
  ];

  const spines = spinePoints
    .map(([x, y]) => `<line x1="512" y1="668" x2="${x}" y2="${y}"/>`)
    .join('\n    ');

  const bg = rounded
    ? `<rect width="1024" height="1024" rx="224" fill="${background}"/>`
    : `<rect width="1024" height="1024" fill="${background}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
  ${bg}
  <circle cx="512" cy="300" r="180" fill="none" stroke="${fgColor}" stroke-width="40"/>
  <ellipse cx="512" cy="720" rx="62" ry="52" fill="${fgColor}"/>
  <g stroke="${fgColor}" stroke-width="22" stroke-linecap="round">
    ${spines}
  </g>
</svg>`;
}

// Notification icon: white shuttlecock on transparent (Android tints it automatically)
function notificationSvg(size) {
  const spinePoints = [
    [33, 37], [31, 28], [33, 20],
    [40, 14], [48, 11], [57, 14],
    [63, 20], [65, 28], [63, 37],
  ];

  const spines = spinePoints
    .map(([x, y]) => `<line x1="48" y1="62" x2="${x}" y2="${y}"/>`)
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">
  <circle cx="48" cy="28" r="17" fill="none" stroke="white" stroke-width="3.5"/>
  <ellipse cx="48" cy="67" rx="5.8" ry="4.9" fill="white"/>
  <g stroke="white" stroke-width="2" stroke-linecap="round">
    ${spines}
  </g>
</svg>`;
}

async function generate() {
  if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

  const tasks = [
    {
      name: 'icon.png',
      svg: shuttlecockSvg(1024, true),
      size: 1024,
    },
    {
      name: 'adaptive-icon.png',
      // Android adaptive icon foreground — no rounded corners, Android clips it
      svg: shuttlecockSvg(1024, false, 'transparent', '#FFFFFF'),
      size: 1024,
    },
    {
      name: 'splash-icon.png',
      svg: shuttlecockSvg(512, false, 'transparent', '#FFFFFF'),
      size: 512,
    },
    {
      name: 'notification-icon.png',
      svg: notificationSvg(96),
      size: 96,
    },
    {
      name: 'favicon.png',
      svg: shuttlecockSvg(32, true),
      size: 32,
    },
  ];

  for (const task of tasks) {
    const outPath = path.join(ASSETS, task.name);
    await sharp(Buffer.from(task.svg))
      .resize(task.size, task.size)
      .png()
      .toFile(outPath);
    console.log(`✓ ${task.name} (${task.size}×${task.size})`);
  }

  console.log('\nAll icons generated in assets/images/');
  console.log('Run `npx expo start --clear` to pick up the new assets.');
}

generate().catch((err) => {
  console.error('Error generating icons:', err.message);
  if (err.message.includes("Cannot find module 'sharp'")) {
    console.error('\nInstall sharp first:  npm install --save-dev sharp');
  }
  process.exit(1);
});
