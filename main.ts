// Meme Sprint 3: AI Agent Goes Rogue — deterministic PNG generator (pure Node, no deps).
// Draws a classic top-text / bottom-text meme: a robot whose one eye has gone red,
// chest screen showing a cancelled calendar, and the punchline about deleted meetings.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const W = 1024;
const H = 1024;

// 5x7 bitmap font: each glyph is 7 rows of 5 bits (MSB = leftmost pixel).
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  "3": [31, 1, 1, 14, 1, 1, 31],
  "-": [0, 0, 0, 14, 0, 0, 0],
  " ": [0, 0, 0, 0, 0, 0, 0],
};

type RGB = [number, number, number];

const NAVY: RGB = [20, 20, 46];
const NAVY2: RGB = [26, 26, 62];
const STEEL: RGB = [217, 217, 227];
const STEEL_DARK: RGB = [160, 160, 180];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const RED: RGB = [230, 30, 30];
const RED_DARK: RGB = [150, 10, 10];
const CYAN: RGB = [80, 220, 235];
const BROWN: RGB = [150, 95, 50];

const px = new Uint8Array(W * H * 3);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPixel(x, y, c);
    }
  }
}

// Thick line (Bresenham + square brush) for the red X and the antenna.
function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(w / 2);
  for (;;) {
    fillRect(x - half, y - half, w, w, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawGlyph(ch: string, x: number, y: number, s: number, c: RGB): void {
  const rows = FONT[ch] ?? FONT[" "];
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (rows[r] & (1 << (4 - col))) {
        fillRect(x + col * s, y + r * s, s, s, c);
      }
    }
  }
}

// Meme-style text: black outline first (8 offsets), then the fill colour on top.
function drawText(text: string, cx: number, y: number, s: number, c: RGB): void {
  const adv = 6 * s;
  const total = text.length * adv - s;
  let x = cx - Math.floor(total / 2);
  const outline = Math.max(2, Math.floor(s / 3));
  for (const ch of text) {
    for (const [ox, oy] of [[-outline, 0], [outline, 0], [0, -outline], [0, outline], [-outline, -outline], [outline, -outline], [-outline, outline], [outline, outline]] as const) {
      drawGlyph(ch, x + ox, y + oy, s, BLACK);
    }
    drawGlyph(ch, x, y, s, c);
    x += adv;
  }
}

function drawRobot(): void {
  // Floor shadow.
  fillRect(300, 712, 424, 18, [12, 12, 30]);
  // Antenna.
  thickLine(512, 252, 512, 208, 8, STEEL_DARK);
  fillCircle(512, 198, 18, RED);
  fillCircle(512, 198, 9, [255, 120, 120]);
  // Head.
  fillRect(382, 252, 260, 178, STEEL);
  fillRect(382, 252, 260, 14, STEEL_DARK);
  // Left eye: calm cyan. Right eye: rogue red with glow ring.
  fillCircle(462, 330, 42, [255, 60, 60]);
  fillCircle(462, 330, 34, CYAN);
  fillCircle(462, 330, 14, BLACK);
  fillCircle(562, 330, 42, [255, 60, 60]);
  fillCircle(562, 330, 34, RED);
  fillCircle(562, 330, 14, RED_DARK);
  // Smirk.
  thickLine(472, 392, 552, 384, 8, BLACK);
  // Ears.
  fillRect(366, 300, 16, 60, STEEL_DARK);
  fillRect(642, 300, 16, 60, STEEL_DARK);
  // Body.
  fillRect(362, 440, 300, 272, STEEL);
  fillRect(362, 440, 300, 14, STEEL_DARK);
  // Chest screen: a calendar with a big red X over it.
  fillRect(442, 492, 140, 120, NAVY2);
  fillRect(458, 508, 108, 88, WHITE);
  for (let i = 1; i < 4; i++) thickLine(458, 508 + i * 22, 566, 508 + i * 22, 2, [200, 200, 210]);
  for (let i = 1; i < 5; i++) thickLine(458 + i * 22, 508, 458 + i * 22, 596, 2, [200, 200, 210]);
  thickLine(448, 498, 576, 606, 12, RED);
  thickLine(576, 498, 448, 606, 12, RED);
  // Arms: left hangs down, right raised holding a mug.
  fillRect(322, 452, 40, 180, STEEL_DARK);
  fillRect(322, 452, 40, 14, STEEL);
  thickLine(662, 470, 700, 400, 36, STEEL_DARK);
  fillRect(676, 340, 56, 62, BROWN);
  fillRect(676, 340, 56, 10, [110, 65, 30]);
  // Legs + feet.
  fillRect(402, 712, 56, 46, STEEL_DARK);
  fillRect(566, 712, 56, 46, STEEL_DARK);
  fillRect(388, 752, 84, 20, STEEL_DARK);
  fillRect(552, 752, 84, 20, STEEL_DARK);
  // Floating to-do sheet with a red X (left of the robot).
  fillRect(196, 500, 110, 140, WHITE);
  for (let i = 0; i < 4; i++) fillRect(212, 524 + i * 28, 78, 8, [120, 120, 140]);
  thickLine(200, 504, 302, 636, 10, RED);
  thickLine(302, 504, 200, 636, 10, RED);
  // Floating lunch tray (right of the robot).
  fillRect(724, 540, 104, 70, [190, 190, 205]);
  fillCircle(752, 566, 16, [255, 200, 60]);
  fillCircle(796, 566, 16, [120, 200, 90]);
}

function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { t?: Int32Array }).t;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    (crc32 as unknown as { t: Int32Array }).t = table;
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function validatePng(buf: Buffer): void {
  if (buf.length > 1_048_576) throw new Error(`entry.png too big: ${buf.length} bytes (cap 1 MiB)`);
  if (buf.readUInt32BE(16) !== W || buf.readUInt32BE(20) !== H) {
    throw new Error("entry.png dimensions are not 1024x1024");
  }
}

function main(): void {
  // Background: dark navy with a subtle lighter band behind the robot.
  fillRect(0, 0, W, H, NAVY);
  fillRect(0, 180, W, 620, NAVY2);
  drawText("MY AI AGENT", 512, 36, 8, WHITE);
  drawText("WENT ROGUE", 512, 112, 8, WHITE);
  drawRobot();
  drawText("IT DELETED EVERY MEETING", 512, 800, 6, WHITE);
  drawText("AND BOOKED ME A 3-HOUR", 512, 852, 6, WHITE);
  drawText("LUNCH WITH MYSELF", 512, 904, 6, WHITE);

  const png = encodePng();
  validatePng(png);
  const outDir = process.env.OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/entry.png`;
  writeFileSync(outPath, png);
  const sha = createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${png.length} bytes (${W}x${H}) to ${outPath} sha256=${sha}`);
}

main();
