// Minimal, dependency-free PNG encoder (24-bit RGB, no palette/alpha needed for our cards).
// Uses only Node's built-in zlib + crypto-free CRC32, so it needs no npm install anywhere it runs.
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// canvas: { width, height, pixels: Uint8Array RGB, length = w*h*3 }
export function encodePng({ width, height, pixels }) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Paeth filter on every scanline (type 4): smooth gradients compress several times smaller than unfiltered.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1), row = y * stride, prev = row - stride;
    raw[o] = 4;
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? pixels[row + i - 3] : 0, b = y ? pixels[prev + i] : 0, c = y && i >= 3 ? pixels[prev + i - 3] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      raw[o + 1 + i] = (pixels[row + i] - pred) & 0xff;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

export function makeCanvas(width, height, bg = [10, 26, 46]) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 3) { pixels[i] = bg[0]; pixels[i + 1] = bg[1]; pixels[i + 2] = bg[2]; }
  return { width, height, pixels };
}
export function fillRect(c, x, y, w, h, [r, g, b]) {
  const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(c.width, x + w), y1 = Math.min(c.height, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let off = (yy * c.width + x0) * 3;
    for (let xx = x0; xx < x1; xx++) { c.pixels[off] = r; c.pixels[off + 1] = g; c.pixels[off + 2] = b; off += 3; }
  }
}
