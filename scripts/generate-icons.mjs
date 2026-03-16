import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(process.cwd());

const OUTPUTS = [
  { size: 32, file: path.join(ROOT, "public", "favicon-32.png") },
  { size: 180, file: path.join(ROOT, "public", "apple-touch-icon.png") },
  { size: 192, file: path.join(ROOT, "public", "icon-192.png") },
  { size: 512, file: path.join(ROOT, "public", "icon-512.png") },
  {
    size: 1024,
    file: path.join(
      ROOT,
      "ios",
      "App",
      "App",
      "Assets.xcassets",
      "AppIcon.appiconset",
      "AppIcon-512@2x.png"
    )
  }
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixRgb(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t))
  ];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function blendPixel(buffer, size, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) {
    return;
  }
  const i = (y * size + x) * 4;
  const dstR = buffer[i];
  const dstG = buffer[i + 1];
  const dstB = buffer[i + 2];
  const dstA = buffer[i + 3] / 255;
  const outA = alpha + dstA * (1 - alpha);
  if (outA <= 0) {
    return;
  }
  buffer[i] = Math.round((color[0] * alpha + dstR * dstA * (1 - alpha)) / outA);
  buffer[i + 1] = Math.round((color[1] * alpha + dstG * dstA * (1 - alpha)) / outA);
  buffer[i + 2] = Math.round((color[2] * alpha + dstB * dstA * (1 - alpha)) / outA);
  buffer[i + 3] = Math.round(outA * 255);
}

function pointInRoundedRect(px, py, x, y, w, h, r) {
  const left = x;
  const right = x + w;
  const top = y;
  const bottom = y + h;

  if (px < left || px > right || py < top || py > bottom) {
    return false;
  }

  const cx = clamp(px, left + r, right - r);
  const cy = clamp(py, top + r, bottom - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function drawRoundedRect(buffer, size, x, y, w, h, radius, color, alpha = 1) {
  const minX = Math.max(0, Math.floor(x));
  const minY = Math.max(0, Math.floor(y));
  const maxX = Math.min(size - 1, Math.ceil(x + w));
  const maxY = Math.min(size - 1, Math.ceil(y + h));

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      if (pointInRoundedRect(px + 0.5, py + 0.5, x, y, w, h, radius)) {
        blendPixel(buffer, size, px, py, color, alpha);
      }
    }
  }
}

function drawCircle(buffer, size, cx, cy, radius, color, alpha = 1) {
  const minX = Math.max(0, Math.floor(cx - radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius));
  const r2 = radius * radius;

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        blendPixel(buffer, size, px, py, color, alpha);
      }
    }
  }
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) {
    return Math.hypot(px - x2, py - y2);
  }
  const t = c1 / c2;
  const projX = x1 + t * vx;
  const projY = y1 + t * vy;
  return Math.hypot(px - projX, py - projY);
}

function drawThickLine(buffer, size, x1, y1, x2, y2, thickness, color, alpha = 1) {
  const half = thickness / 2;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - half - 1));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - half - 1));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + half + 1));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + half + 1));

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const d = distanceToSegment(px + 0.5, py + 0.5, x1, y1, x2, y2);
      if (d <= half) {
        blendPixel(buffer, size, px, py, color, alpha);
      }
    }
  }
}

function createIconPixels(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const topColor = [15, 118, 110];
  const bottomColor = [37, 99, 235];
  const glowColor = [255, 255, 255];

  for (let y = 0; y < size; y += 1) {
    const tY = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const tX = x / (size - 1);
      const base = mixRgb(topColor, bottomColor, tY * 0.9 + 0.05);
      const glow = Math.max(0, 1 - Math.hypot(tX - 0.76, tY - 0.18) / 0.82);
      const r = Math.round(base[0] + glowColor[0] * glow * 0.1);
      const g = Math.round(base[1] + glowColor[1] * glow * 0.09);
      const b = Math.round(base[2] + glowColor[2] * glow * 0.13);
      const i = (y * size + x) * 4;
      pixels[i] = clamp(r, 0, 255);
      pixels[i + 1] = clamp(g, 0, 255);
      pixels[i + 2] = clamp(b, 0, 255);
      pixels[i + 3] = 255;
    }
  }

  const cardX = size * 0.12;
  const cardY = size * 0.12;
  const cardW = size * 0.76;
  const cardH = size * 0.76;
  drawRoundedRect(pixels, size, cardX, cardY, cardW, cardH, size * 0.14, [255, 255, 255], 0.15);
  drawRoundedRect(pixels, size, cardX, cardY, cardW, cardH, size * 0.14, [10, 34, 70], 0.12);

  const panelW = size * 0.2;
  const panelH = size * 0.42;
  const panelY = size * 0.28;
  drawRoundedRect(pixels, size, size * 0.24, panelY, panelW, panelH, size * 0.055, [250, 252, 255], 0.92);
  drawRoundedRect(pixels, size, size * 0.56, panelY, panelW, panelH, size * 0.055, [250, 252, 255], 0.92);

  const lineColor = [53, 98, 196];
  const lineAlpha = 0.72;
  for (const panelX of [size * 0.28, size * 0.6]) {
    const lineW = size * 0.12;
    const h = size * 0.024;
    const r = size * 0.01;
    drawRoundedRect(pixels, size, panelX, size * 0.345, lineW, h, r, lineColor, lineAlpha);
    drawRoundedRect(pixels, size, panelX, size * 0.392, lineW * 0.82, h, r, lineColor, lineAlpha);
    drawRoundedRect(pixels, size, panelX, size * 0.438, lineW * 0.68, h, r, lineColor, lineAlpha);
  }

  drawCircle(pixels, size, size * 0.5, size * 0.62, size * 0.15, [255, 255, 255], 0.97);
  drawCircle(pixels, size, size * 0.5, size * 0.62, size * 0.156, [13, 80, 166], 0.34);
  drawThickLine(
    pixels,
    size,
    size * 0.44,
    size * 0.62,
    size * 0.49,
    size * 0.675,
    size * 0.04,
    [14, 84, 173],
    0.98
  );
  drawThickLine(
    pixels,
    size,
    size * 0.49,
    size * 0.675,
    size * 0.59,
    size * 0.56,
    size * 0.04,
    [14, 84, 173],
    0.98
  );

  return pixels;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunks = [
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0))
  ];
  return Buffer.concat([signature, ...chunks]);
}

for (const target of OUTPUTS) {
  const pixels = createIconPixels(target.size);
  const png = encodePng(target.size, pixels);
  fs.mkdirSync(path.dirname(target.file), { recursive: true });
  fs.writeFileSync(target.file, png);
  process.stdout.write(`Generated ${target.file}\n`);
}
