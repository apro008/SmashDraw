/**
 * Generates all app icon and splash screen assets from SVG definitions.
 * Run: node scripts/generate-icons.js
 * Requires: npm install --save-dev sharp
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets', 'images');
const PRIMARY = '#1A73E8';
const DARK_BG = '#0D1B2E';

// ─── Shuttlecock spine helper ─────────────────────────────────────────────────
// Returns 9 SVG <line> elements fanning from (fromX, fromY) to a ring
// centered at (ringCx, ringCy) with radius ringR.
function spineLines(fromX, fromY, ringCx, ringCy, ringR, strokeColor, strokeWidth) {
  const baseSpines = [
    [356, 390], [332, 300], [356, 210],
    [422, 144], [512, 120], [602, 144],
    [668, 210], [692, 300], [668, 390],
  ];
  const scale = ringR / 180;
  return baseSpines
    .map(([bx, by]) => {
      const x = (ringCx + (bx - 512) * scale).toFixed(1);
      const y = (ringCy + (by - 300) * scale).toFixed(1);
      return `<line x1="${fromX}" y1="${fromY}" x2="${x}" y2="${y}"/>`;
    })
    .join('\n    ');
}

// ─── App icon SVG (1024×1024 viewBox) ─────────────────────────────────────────
// White shuttlecock on blue rounded-rect.
function iconSvg(size, rounded = true, bg = PRIMARY, fg = '#FFFFFF') {
  const ringCx = 512, ringCy = 300, ringR = 185;
  const corkCx = 512, corkCy = 720;
  const fromX = 512, fromY = 672;

  const bgShape = rounded
    ? `<rect width="1024" height="1024" rx="230" fill="${bg}"/>`
    : `<rect width="1024" height="1024" fill="${bg}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
  <defs>
    <radialGradient id="ig" cx="50%" cy="38%" r="45%">
      <stop offset="0%" stop-color="#2A85FF" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${bgShape}
  ${bg !== 'transparent' ? `<rect width="1024" height="1024" ${rounded ? 'rx="230"' : ''} fill="url(#ig)"/>` : ''}
  <circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="${fg === '#FFFFFF' ? 'rgba(255,255,255,0.10)' : 'none'}" stroke="${fg}" stroke-width="44"/>
  <g stroke="${fg}" stroke-width="22" stroke-linecap="round">
    ${spineLines(fromX, fromY, ringCx, ringCy, ringR, fg, 22)}
  </g>
  <ellipse cx="${corkCx}" cy="${corkCy}" rx="68" ry="56" fill="${fg === '#FFFFFF' ? '#FDE68A' : fg}"/>
</svg>`;
}

// ─── Notification icon SVG (white on transparent) ─────────────────────────────
function notificationSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">
  <circle cx="48" cy="28" r="17" fill="none" stroke="white" stroke-width="4"/>
  <ellipse cx="48" cy="68" rx="6" ry="5" fill="white"/>
  <g stroke="white" stroke-width="2.2" stroke-linecap="round">
    <line x1="48" y1="63" x2="33" y2="37"/><line x1="48" y1="63" x2="31" y2="28"/>
    <line x1="48" y1="63" x2="33" y2="20"/><line x1="48" y1="63" x2="40" y2="14"/>
    <line x1="48" y1="63" x2="48" y2="11"/><line x1="48" y1="63" x2="56" y2="14"/>
    <line x1="48" y1="63" x2="63" y2="20"/><line x1="48" y1="63" x2="65" y2="28"/>
    <line x1="48" y1="63" x2="63" y2="37"/>
  </g>
</svg>`;
}

// ─── Splash screen SVG (1080×1920 portrait) ───────────────────────────────────
// Full-bleed: dark navy bg + court lines + central glow + large shuttlecock
// + app name + tagline + corner accents.
function splashSvg(outW, outH) {
  const W = 1080, H = 1920;

  // Shuttlecock geometry (centered slightly above vertical mid)
  const ringCx = 540, ringCy = 680, ringR = 210;
  const corkCx = 540, corkCy = 1155;
  const fromX = 540, fromY = 1098;

  const spines = spineLines(fromX, fromY, ringCx, ringCy, ringR, 'white', 24);

  // Badminton court lines (full court, portrait, very faint)
  const cx2 = 540;
  const cLeft = 100, cRight = 980, cTop = 140, cBottom = 1780;
  const cW = cRight - cLeft, cH = cBottom - cTop;
  const netY = (cTop + cBottom) / 2;
  const svcT = cTop + cH * 0.198;  // service line top half
  const svcB = cBottom - cH * 0.198; // service line bottom half
  const sidL = cLeft + cW * 0.11;   // singles side left
  const sidR = cRight - cW * 0.11;  // singles side right

  // Corner mini-shuttles
  const miniShuttle = (tx, ty, rot) => {
    const mr = 38, mcx = 0, mcy = -60, mfrom = [0, 60];
    const mSpines = [
      [[-33, -30], [-38, 0], [-33, 30],
       [-20, 57], [0, 66], [20, 57],
       [33, 30], [38, 0], [33, -30]],
    ][0];
    const sc = mr / 38;
    const ls = mSpines
      .map(([bx, by]) => `<line x1="${mfrom[0]}" y1="${mfrom[1]}" x2="${(bx * sc).toFixed(1)}" y2="${(by * sc).toFixed(1)}"/>`)
      .join('');
    return `
  <g transform="translate(${tx},${ty}) rotate(${rot})" opacity="0.18">
    <circle cx="${mcx}" cy="${mcy}" r="${mr}" fill="none" stroke="white" stroke-width="7"/>
    <g stroke="white" stroke-width="4" stroke-linecap="round">${ls}</g>
    <ellipse cx="${mcx}" cy="72" rx="12" ry="10" fill="white"/>
  </g>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${outW}" height="${outH}">
  <defs>
    <radialGradient id="topGlow" cx="50%" cy="35%" r="40%">
      <stop offset="0%" stop-color="#1E3A8A" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${DARK_BG}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="corkGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FDE68A" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#FDE68A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ringGlow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${DARK_BG}"/>

  <!-- Court lines (very faint) -->
  <g stroke="rgba(255,255,255,0.07)" stroke-width="3" fill="none">
    <rect x="${cLeft}" y="${cTop}" width="${cW}" height="${cH}"/>
    <line x1="${sidL}" y1="${cTop}" x2="${sidL}" y2="${cBottom}"/>
    <line x1="${sidR}" y1="${cTop}" x2="${sidR}" y2="${cBottom}"/>
    <line x1="${cx2}" y1="${cTop}" x2="${cx2}" y2="${cBottom}"/>
  </g>
  <line x1="${cLeft}" y1="${netY}" x2="${cRight}" y2="${netY}" stroke="rgba(255,255,255,0.14)" stroke-width="5"/>
  <g stroke="rgba(255,255,255,0.07)" stroke-width="2.5" fill="none">
    <line x1="${cLeft}" y1="${svcT}" x2="${cRight}" y2="${svcT}"/>
    <line x1="${cLeft}" y1="${svcB}" x2="${cRight}" y2="${svcB}"/>
  </g>

  <!-- Top blue glow -->
  <rect width="${W}" height="${H}" fill="url(#topGlow)"/>

  <!-- Feather ring glow -->
  <ellipse cx="${ringCx}" cy="${ringCy}" rx="${ringR + 60}" ry="${ringR + 60}" fill="url(#ringGlow)"/>

  <!-- Cork glow -->
  <ellipse cx="${corkCx}" cy="${corkCy}" rx="130" ry="110" fill="url(#corkGlow)"/>

  <!-- Feather ring -->
  <circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="rgba(255,255,255,0.06)" stroke="white" stroke-width="42"/>

  <!-- 9 feather spines -->
  <g stroke="white" stroke-width="22" stroke-linecap="round" opacity="0.95">
    ${spines}
  </g>

  <!-- Cork body -->
  <ellipse cx="${corkCx}" cy="${corkCy}" rx="80" ry="66" fill="#F59E0B"/>
  <!-- Cork highlight -->
  <ellipse cx="${corkCx}" cy="${corkCy - 18}" rx="52" ry="28" fill="#FDE68A" opacity="0.70"/>

  <!-- Corner mini-shuttles (decorative) -->
  ${miniShuttle(130, 220, -30)}
  ${miniShuttle(950, 220, 30)}
  ${miniShuttle(130, 1700, -150)}
  ${miniShuttle(950, 1700, 150)}

  <!-- App name -->
  <text x="${W / 2}" y="${corkCy + 180}"
    font-family="Arial Black, Impact, sans-serif"
    font-size="108"
    font-weight="900"
    fill="white"
    text-anchor="middle"
    letter-spacing="5">SmashDraw</text>

  <!-- Tagline -->
  <text x="${W / 2}" y="${corkCy + 272}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="38"
    fill="rgba(255,255,255,0.42)"
    text-anchor="middle"
    letter-spacing="10">TOURNAMENT MANAGER</text>

  <!-- Thin accent line under tagline -->
  <line x1="${W / 2 - 80}" y1="${corkCy + 304}" x2="${W / 2 + 80}" y2="${corkCy + 304}"
    stroke="rgba(255,255,255,0.20)" stroke-width="1.5"/>
</svg>`;
}

// ─── Build tasks ──────────────────────────────────────────────────────────────
async function generate() {
  if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

  const tasks = [
    // App icon — blue rounded-rect background, white shuttlecock
    { name: 'icon.png', svg: iconSvg(1024, true), size: 1024 },

    // Android adaptive icon foreground — white shuttle on transparent
    // (Android clips to its own shape and adds the blue background via app.json)
    { name: 'adaptive-icon.png', svg: iconSvg(1024, false, 'transparent', '#FFFFFF'), size: 1024 },

    // Notification icon — white on transparent (Android tints automatically)
    { name: 'notification-icon.png', svg: notificationSvg(96), size: 96 },

    // Web favicon
    { name: 'favicon.png', svg: iconSvg(64, true), size: 64 },

    // Splash screen — full portrait, everything baked in
    { name: 'splash-icon.png', svg: splashSvg(1080, 1920), size: null, w: 1080, h: 1920 },
  ];

  for (const task of tasks) {
    const outPath = path.join(ASSETS, task.name);
    const img = sharp(Buffer.from(task.svg));
    if (task.size) {
      img.resize(task.size, task.size);
    }
    await img.png().toFile(outPath);
    const label = task.size ? `${task.size}×${task.size}` : `${task.w}×${task.h}`;
    console.log(`✓ ${task.name} (${label})`);
  }

  console.log('\nAll assets written to assets/images/');
  console.log('Run `npx expo start --clear` to pick up the new assets.\n');
}

generate().catch((err) => {
  console.error('Error:', err.message);
  if (err.message.includes("Cannot find module 'sharp'")) {
    console.error('Install sharp:  npm install --save-dev sharp');
  }
  process.exit(1);
});
