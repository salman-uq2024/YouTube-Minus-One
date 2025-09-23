const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUTPUTS = [
  { size: 512, file: path.join(__dirname, '..', 'public', 'icon.png') },
  { size: 180, file: path.join(__dirname, '..', 'public', 'apple-icon.png') }
];

const ICO_OUTPUT = path.join(__dirname, '..', 'public', 'favicon.ico');

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function isInsideRoundedRect(x, y, centerX, centerY, width, height, radius) {
  const dx = Math.abs(x - centerX);
  const dy = Math.abs(y - centerY);
  const halfW = width / 2;
  const halfH = height / 2;
  if (dx <= halfW - radius && dy <= halfH) return true;
  if (dy <= halfH - radius && dx <= halfW) return true;
  const cornerX = dx - (halfW - radius);
  const cornerY = dy - (halfH - radius);
  if (cornerX < 0 || cornerY < 0) return false;
  return cornerX * cornerX + cornerY * cornerY <= radius * radius;
}

function barycentric(point, a, b, c) {
  const v0x = b.x - a.x;
  const v0y = b.y - a.y;
  const v1x = c.x - a.x;
  const v1y = c.y - a.y;
  const v2x = point.x - a.x;
  const v2y = point.y - a.y;
  const denom = v0x * v1y - v1x * v0y;
  if (denom === 0) return { u: 0, v: 0, w: 0 };
  const invDenom = 1 / denom;
  const u = (v2x * v1y - v1x * v2y) * invDenom;
  const v = (v0x * v2y - v2x * v0y) * invDenom;
  const w = 1 - u - v;
  return { u, v, w };
}

function isInsideTriangle(point, a, b, c) {
  const { u, v, w } = barycentric(point, a, b, c);
  return u >= 0 && v >= 0 && w >= 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c >>>= 1;
      }
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  chunk.writeUInt32BE(crc, 8 + data.length);
  return chunk;
}

function generatePng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const centerX = size / 2;
  const centerY = size / 2;
  const rectWidth = size * 0.78;
  const rectHeight = size * 0.58;
  const cornerRadius = size * 0.17;

  const triangle = {
    a: { x: centerX - size * 0.09, y: centerY - size * 0.19 },
    b: { x: centerX + size * 0.2, y: centerY },
    c: { x: centerX - size * 0.09, y: centerY + size * 0.19 }
  };

  const notch = {
    a: { x: centerX + size * 0.08, y: centerY - size * 0.06 },
    b: triangle.b,
    c: { x: centerX + size * 0.08, y: centerY + size * 0.06 }
  };

  const samples = [
    { dx: 0.25, dy: 0.25 },
    { dx: 0.75, dy: 0.25 },
    { dx: 0.25, dy: 0.75 },
    { dx: 0.75, dy: 0.75 }
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (const sample of samples) {
        const px = x + sample.dx;
        const py = y + sample.dy;
        if (!isInsideRoundedRect(px, py, centerX, centerY, rectWidth, rectHeight, cornerRadius)) {
          continue;
        }

        const gradientT = Math.min(
          1,
          Math.max(0, (py - (centerY - rectHeight / 2)) / rectHeight)
        );

        let sr = lerp(242, 190, gradientT);
        let sg = lerp(45, 20, gradientT);
        let sb = lerp(56, 24, gradientT);

        const highlightDX = px - (centerX - rectWidth * 0.25);
        const highlightDY = py - (centerY - rectHeight * 0.28);
        const highlight = highlightDX * highlightDX + highlightDY * highlightDY < (size * 0.18) ** 2;
        if (highlight) {
          sr = lerp(sr, 255, 0.12);
          sg = lerp(sg, 245, 0.12);
          sb = lerp(sb, 245, 0.12);
        }

        const accent =
          Math.abs(py - centerY) < size * 0.02 &&
          Math.abs(px - (centerX - rectWidth * 0.35)) < size * 0.12;
        if (accent) {
          sr = lerp(sr, 255, 0.2);
          sg = lerp(sg, 190, 0.2);
          sb = lerp(sb, 120, 0.2);
        }

        const insideTriangle = isInsideTriangle({ x: px, y: py }, triangle.a, triangle.b, triangle.c);
        const insideNotch = isInsideTriangle({ x: px, y: py }, notch.a, notch.b, notch.c);
        if (insideTriangle && !insideNotch) {
          sr = 253;
          sg = 249;
          sb = 246;
        }

        r += sr;
        g += sg;
        b += sb;
        a += 255;
      }

      const sampleDivisor = samples.length;
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(r / sampleDivisor);
      pixels[offset + 1] = Math.round(g / sampleDivisor);
      pixels[offset + 2] = Math.round(b / sampleDivisor);
      pixels[offset + 3] = Math.round(a / sampleDivisor);
    }
  }

  const rowSize = size * 4;
  const raw = Buffer.alloc((rowSize + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[(rowSize + 1) * y] = 0;
    pixels.copy(raw, (rowSize + 1) * y + 1, y * rowSize, (y + 1) * rowSize);
  }

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunks = [
    createChunk('IHDR', ihdr),
    createChunk('IDAT', idat),
    createChunk('IEND', Buffer.alloc(0))
  ];

  return Buffer.concat([pngSignature, ...chunks]);
}

function createIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

function main() {
  fs.mkdirSync(path.join(__dirname, '..', 'public'), { recursive: true });

  const buffers = OUTPUTS.map(({ size, file }) => {
    const png = generatePng(size);
    fs.writeFileSync(file, png);
    return { size, png };
  });

  const faviconPng = generatePng(64);
  fs.writeFileSync(ICO_OUTPUT, createIco(faviconPng, 64));
}

main();
