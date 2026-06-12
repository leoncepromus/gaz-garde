/**
 * Regenerate Expo asset PNGs (valid format for EAS prebuild / jimp).
 */
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

const BG = { r: 15, g: 118, b: 110 }; // GasSafer teal
const FG = { r: 255, g: 255, b: 255 };

function setPixel(png, x, y, color, alpha = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = alpha;
}

function fill(png, color) {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      setPixel(png, x, y, color);
    }
  }
}

function drawCircle(png, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(png, x, y, color);
      }
    }
  }
}

function drawGasSaferMark(png) {
  const w = png.width;
  const h = png.height;
  fill(png, BG);

  const cx = w / 2;
  const cy = h / 2;
  drawCircle(png, cx, cy, w * 0.28, FG);

  const barW = Math.max(2, Math.round(w * 0.045));
  const barH = Math.round(h * 0.22);
  const gap = Math.round(w * 0.08);
  const baseY = cy + barH * 0.15;

  for (const offset of [-gap, 0, gap]) {
    const left = Math.round(cx + offset - barW / 2);
    for (let y = Math.round(baseY - barH); y <= Math.round(baseY); y++) {
      for (let x = left; x < left + barW; x++) {
        setPixel(png, x, y, BG);
      }
    }
  }
}

function writePng(png, filePath) {
  return new Promise((resolve, reject) => {
    const stream = png
      .pack()
      .pipe(fs.createWriteStream(filePath))
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function createAsset(name, size) {
  const png = new PNG({ width: size, height: size });
  drawGasSaferMark(png);
  const filePath = path.join(assetsDir, name);
  await writePng(png, filePath);
  console.log(`Wrote ${filePath} (${size}x${size})`);
}

fs.mkdirSync(assetsDir, { recursive: true });

await createAsset('icon.png', 1024);
await createAsset('adaptive-icon.png', 1024);
await createAsset('splash-icon.png', 512);
await createAsset('favicon.png', 48);

console.log('Done — assets are valid PNGs for EAS prebuild.');
