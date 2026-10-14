import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function pixelIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const blue = [18, 59, 102, 255], white = [255, 255, 255, 255], mint = [85, 214, 190, 255];
  const lineDistance = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };
  const lines = [
    [0.30, 0.27, 0.30, 0.73, 0.038, white],
    [0.30, 0.50, 0.56, 0.27, 0.038, white],
    [0.30, 0.50, 0.56, 0.73, 0.038, white],
    [0.64, 0.34, 0.84, 0.34, 0.028, mint],
    [0.74, 0.24, 0.74, 0.44, 0.028, mint],
    [0.62, 0.60, 0.82, 0.60, 0.022, white],
    [0.62, 0.70, 0.77, 0.70, 0.022, white]
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size, ny = (y + 0.5) / size;
      let color = blue;
      for (const [x1,y1,x2,y2,thickness,ink] of lines) {
        if (lineDistance(nx, ny, x1, y1, x2, y2) <= thickness / 2) { color = ink; break; }
      }
      const i = (y * size + x) * 4;
      pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2]; pixels[i + 3] = color[3];
    }
  }
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) pixels.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
for (const size of [192, 512]) {
  const file = path.join(publicDir, `pwa-${size}.png`);
  fs.writeFileSync(file, pixelIcon(size));
  console.log(`Generated ${file}`);
}
