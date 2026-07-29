"use strict";

/**
 * Corner chroma-key → alpha for cultivator generated PNGs (pure Node, no deps).
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crc32Table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readChunk(buf, offset) {
  const len = buf.readUInt32BE(offset);
  const type = buf.toString("ascii", offset + 4, offset + 8);
  const data = buf.subarray(offset + 8, offset + 8 + len);
  return { len, type, data, next: offset + 12 + len };
}

function decodePng(buf) {
  if (buf.toString("hex", 0, 8) !== "89504e470d0a1a0a") throw new Error("not png");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idat = [];
  while (offset < buf.length) {
    const chunk = readChunk(buf, offset);
    offset = chunk.next;
    if (chunk.type === "IHDR") {
      width = chunk.data.readUInt32BE(0);
      height = chunk.data.readUInt32BE(4);
      bitDepth = chunk.data[8];
      colorType = chunk.data[9];
    } else if (chunk.type === "IDAT") {
      idat.push(chunk.data);
    } else if (chunk.type === "IEND") break;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png colorType=${colorType} bitDepth=${bitDepth}`);
  }
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src++];
    const row = Buffer.alloc(stride);
    inflated.copy(row, 0, src, src + stride);
    src += stride;
    if (filter === 1) {
      for (let i = bpp; i < stride; i += 1) row[i] = (row[i] + row[i - bpp]) & 0xff;
    } else if (filter === 2) {
      for (let i = 0; i < stride; i += 1) row[i] = (row[i] + prev[i]) & 0xff;
    } else if (filter === 3) {
      for (let i = 0; i < stride; i += 1) {
        const a = i >= bpp ? row[i - bpp] : 0;
        row[i] = (row[i] + Math.floor((a + prev[i]) / 2)) & 0xff;
      }
    } else if (filter === 4) {
      for (let i = 0; i < stride; i += 1) {
        const a = i >= bpp ? row[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        row[i] = (row[i] + pr) & 0xff;
      }
    } else if (filter !== 0) {
      throw new Error(`unsupported filter ${filter}`);
    }
    for (let x = 0; x < width; x += 1) {
      const si = x * bpp;
      const di = (y * width + x) * 4;
      rgba[di] = row[si];
      rgba[di + 1] = row[si + 1];
      rgba[di + 2] = row[si + 2];
      rgba[di + 3] = bpp === 4 ? row[si + 3] : 255;
    }
    prev = row;
  }
  return { width, height, rgba };
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const o = y * (stride + 1);
    raw[o] = 0;
    rgba.copy(raw, o + 1, y * stride, y * stride + stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function chunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function sampleRef(rgba, width, height) {
  const pts = [
    [2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3],
    [Math.floor(width / 2), 2], [2, Math.floor(height / 2)],
  ];
  let r = 0; let g = 0; let b = 0;
  for (const [x, y] of pts) {
    const i = (y * width + x) * 4;
    r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2];
  }
  return { r: r / pts.length, g: g / pts.length, b: b / pts.length };
}

function isNearBlack(r, g, b) {
  return Math.max(r, g, b) < 42 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
}

function isPaleHaze(r, g, b, a) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (min > 200 && max - min < 40) return true;
  if (a < 40 && min > 160 && max - min < 50) return true;
  if (a < 60 && min > 210) return true;
  return false;
}

/**
 * After corner chroma-key: flood from the border through near-black gaps (e.g. between
 * golden halo rays) and pale cream fringes so they become true alpha. Interior dark
 * pixels (hair curls) stay — they are not edge-connected through bg-like colors.
 */
function floodClearEdgeBackground(rgba, width, height) {
  const seen = new Uint8Array(width * height);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    seen[idx] = 1;
    q.push(idx);
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (q.length) {
    const idx = q.pop();
    const i = idx * 4;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];
    const bg = a < 8 || isNearBlack(r, g, b) || isPaleHaze(r, g, b, a);
    if (!bg) continue;
    if (a >= 8) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 0;
    }
    const x = idx % width;
    const y = (idx / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  // Strip remaining low-alpha pale haze anywhere (glow fringes not edge-connected).
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 8) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      continue;
    }
    if (isPaleHaze(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3])) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 0;
    }
  }
}

function processFile(filePath) {
  const decoded = decodePng(fs.readFileSync(filePath));
  const { width, height, rgba } = decoded;
  const ref = sampleRef(rgba, width, height);
  const hard = 30;
  const soft = 62;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];
    if (a === 0) continue;
    const dr = r - ref.r;
    const dg = g - ref.g;
    const db = b - ref.b;
    const d = Math.sqrt(dr * dr + dg * dg + db * db);
    if (d <= hard) rgba[i + 3] = 0;
    else if (d < soft) rgba[i + 3] = Math.round(a * ((d - hard) / (soft - hard)));
  }
  floodClearEdgeBackground(rgba, width, height);
  fs.writeFileSync(filePath, encodePng(width, height, rgba));
}

function main(argv = process.argv.slice(2)) {
  const dir = argv[0]
    ? path.resolve(argv[0])
    : path.join(__dirname, "..", "assets", "source", "cultivator", "generated");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));
  for (const file of files) {
    const full = path.join(dir, file);
    processFile(full);
    console.log(`transparent: ${file}`);
  }
  console.log(`processed ${files.length} png(s)`);
}

if (require.main === module) main();

module.exports = { processFile, decodePng, encodePng };
