const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeIcon(size, filename) {
  const width = size, height = size;
  const px = Buffer.alloc(width * height * 4);
  const bg = [15, 148, 131, 255];    // #0F9483 teal
  const white = [251, 249, 244, 255]; // warm off-white (matches app surface)

  function setPx(x, y, c) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  }
  function fillRect(x0, y0, w, h, c) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(x, y, c);
  }
  function fillCircle(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) setPx(cx + x, cy + y, c);
    }
  }
  function fillRoundedRect(x0, y0, w, h, r, c) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        let dx = 0, dy = 0, corner = false;
        if (x < x0 + r && y < y0 + r) { dx = x - (x0 + r); dy = y - (y0 + r); corner = true; }
        else if (x >= x0 + w - r && y < y0 + r) { dx = x - (x0 + w - r - 1); dy = y - (y0 + r); corner = true; }
        else if (x < x0 + r && y >= y0 + h - r) { dx = x - (x0 + r); dy = y - (y0 + h - r - 1); corner = true; }
        else if (x >= x0 + w - r && y >= y0 + h - r) { dx = x - (x0 + w - r - 1); dy = y - (y0 + h - r - 1); corner = true; }
        if (corner && dx * dx + dy * dy > r * r) continue;
        setPx(x, y, c);
      }
    }
  }

  fillRect(0, 0, width, height, bg);

  const m = Math.round(width * 0.20);
  const nbX = m, nbY = Math.round(height * 0.14), nbW = width - 2 * m, nbH = Math.round(height * 0.72);
  fillRoundedRect(nbX, nbY, nbW, nbH, Math.round(width * 0.045), white);

  const dots = 5;
  const spiralX = nbX + Math.round(nbW * 0.14);
  const rr = Math.max(2, Math.round(width * 0.016));
  for (let i = 0; i < dots; i++) {
    const cy = nbY + Math.round(nbH * (0.13 + i * 0.185));
    fillCircle(spiralX, cy, rr, bg);
  }

  const ribbonW = Math.round(nbW * 0.11);
  const ribbonX = nbX + Math.round(nbW * 0.70);
  fillRect(ribbonX, nbY, ribbonW, Math.round(nbH * 0.4), bg);

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    px.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(filename, png);
  console.log('wrote', filename, png.length, 'bytes');
}

const outDir = process.argv[2];
makeIcon(192, path.join(outDir, 'icon-192.png'));
makeIcon(512, path.join(outDir, 'icon-512.png'));
makeIcon(180, path.join(outDir, 'apple-touch-icon.png'));
