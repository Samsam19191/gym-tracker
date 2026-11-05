// Renders the app icon to PNG at the sizes iOS and Android need. Run: npm run icons
import { chromium } from '@playwright/test';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#1b1b21"/>
      <stop offset="1" stop-color="#0a0a0c"/>
    </radialGradient>
    <linearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF8A5C"/>
      <stop offset="0.5" stop-color="#B892FF"/>
      <stop offset="1" stop-color="#5CA8FF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="268" r="150" fill="none" stroke="#26262d" stroke-width="30"/>
  <circle cx="256" cy="268" r="150" fill="none" stroke="url(#arc)" stroke-width="30" stroke-linecap="round"
          stroke-dasharray="${2 * Math.PI * 150}" stroke-dashoffset="${2 * Math.PI * 150 * 0.28}" transform="rotate(-90 256 268)"/>
  <rect x="226" y="72" width="60" height="30" rx="15" fill="#f4f4f5"/>
  <path d="M206 228v80M306 228v80M180 246v44M332 246v44M206 268h100" stroke="#3EE0B0" stroke-width="22" stroke-linecap="round" fill="none"/>
</svg>`;

const sizes = [
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
];

const browser = await chromium.launch();
for (const [file, size] of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:#0a0a0c">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await browser.close();
console.log('icons written');
