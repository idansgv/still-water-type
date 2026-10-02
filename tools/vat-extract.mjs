// Turns the Houdini Vellum crumple (a Vertex Animation Texture, MIT licensed, by Toi Nagasawa / ITEM Inc.)
// into one small binary the Sheet poster can play back on the GPU.
//
//   source: https://github.com/item-develop/paper-crumple-demo  (vat/geo/*.fbx and vat/tex/*.exr)
//   usage:  in a scratch folder with `npm i three` and the two files next to this script:
//             node vat-extract.mjs vertex_animation_textures1_mesh.fbx vertex_animation_textures1_pos.exr out.bin
//
// The decoding follows the article "Building an Interactive Crumpled Paper Effect with Houdini VAT and
// Three.js" (Codrops, 2026): rows are flipped, the X displacement is negated, and the dummy triangles'
// vertices (UV2 = 0,0) are skipped. Output, little endian:
//
//   header   magic 'CRMP', u32 frames, u32 width, u32 height                        (16 bytes)
//   disp     i16 x frames x height x width x 3   displacement from rest, in sheet units of 1/16384
//   nrm      u8  x frames x height x width x 4   normal (0..255 for -1..1) and a cavity term in alpha
//
// Axes are remapped to the poster's: x stays x, Houdini's -z becomes y (up the sheet), Houdini's y (up from
// the paper) becomes z (toward the viewer). Cell (0, 0) is the bottom-left of the sheet.
import fs from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const [, , fbxPath, exrPath, outPath] = process.argv;
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

const group = new FBXLoader().parse(ab(fs.readFileSync(fbxPath)), '');
let mesh; group.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
const pos = mesh.geometry.getAttribute('position');
const uv2 = mesh.geometry.getAttribute('uv1');

const exr = new EXRLoader(); exr.setDataType(THREE.FloatType);
const tex = exr.parse(ab(fs.readFileSync(exrPath)));
const texW = tex.width, texH = tex.height, ch = tex.data.length / (texW * texH);
const FRAMES = 50, POINTS = 3500, rows = Math.ceil(POINTS / texW), totalRows = FRAMES * rows;

// which simulation point does each vertex belong to, and where does it rest
const rest = new Float32Array(POINTS * 3).fill(NaN);
for (let v = 0; v < pos.count; v++) {
  const u = uv2.getX(v), w = uv2.getY(v);
  if (u === 0 && w === 0) continue;                                    // dummy triangles
  const p = Math.floor((1 - w) * texH) * texW + Math.floor(u * texW);
  rest[p * 3] = pos.getX(v); rest[p * 3 + 1] = pos.getY(v); rest[p * 3 + 2] = pos.getZ(v);
}

// the simulation points form a regular grid on the flat paper: find each point's cell
const xs = [], zs = [];
for (let p = 0; p < POINTS; p++) { xs.push(rest[p * 3]); zs.push(rest[p * 3 + 2]); }
const xmin = Math.min(...xs), xmax = Math.max(...xs), zmin = Math.min(...zs), zmax = Math.max(...zs);
const W = 70, H = 50;                                                          // 70 columns across the paper (x), 50 rows up it
const cell = new Int32Array(POINTS);
const seen = new Set();
for (let p = 0; p < POINTS; p++) {
  const ix = Math.round((rest[p * 3] - xmin) / (xmax - xmin) * (W - 1));
  const jy = Math.round((zmax - rest[p * 3 + 2]) / (zmax - zmin) * (H - 1));   // houdini -z is up the sheet
  cell[p] = jy * W + ix;
  seen.add(cell[p]);
}
if (seen.size !== POINTS) throw new Error(`grid mapping collided: ${seen.size} cells for ${POINTS} points`);
const sheetH = zmax - zmin;                                                    // sheet units: height of the paper

const disp = new Int16Array(FRAMES * H * W * 3);
const nrm = new Uint8Array(FRAMES * H * W * 4);
const P = new Float32Array(H * W * 3);                                          // positions of one frame, poster axes
const R = new Float32Array(H * W * 3);
for (let p = 0; p < POINTS; p++) { const c = cell[p]; R[c * 3] = rest[p * 3]; R[c * 3 + 1] = -rest[p * 3 + 2]; R[c * 3 + 2] = 0; }

const at = (i, j) => (Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))) * 3;
let maxD = 0;
for (let f = 0; f < FRAMES; f++) {
  for (let p = 0; p < POINTS; p++) {
    const col = p % texW, row = totalRows - 1 - (f * rows + Math.floor(p / texW));
    const idx = (row * texW + col) * ch;
    const c = cell[p];
    const hx = rest[p * 3] - tex.data[idx], hy = rest[p * 3 + 1] + tex.data[idx + 1], hz = rest[p * 3 + 2] + tex.data[idx + 2];
    P[c * 3] = hx; P[c * 3 + 1] = -hz; P[c * 3 + 2] = hy;
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = (j * W + i) * 3, d = ((f * H + j) * W + i);
      for (let k = 0; k < 3; k++) {
        const v = (P[o + k] - R[o + k]) / sheetH;                               // in units of sheet height
        maxD = Math.max(maxD, Math.abs(v));
        disp[d * 3 + k] = Math.max(-32767, Math.min(32767, Math.round(v * 16384)));
      }
      // normal from central differences, turned to face +z; cavity from how far the neighbours sit in front of it
      const a = at(i + 1, j), b = at(i - 1, j), c2 = at(i, j + 1), d2 = at(i, j - 1);
      const tu = [P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]];
      const tv = [P[c2] - P[d2], P[c2 + 1] - P[d2 + 1], P[c2 + 2] - P[d2 + 2]];
      let n = [tu[1] * tv[2] - tu[2] * tv[1], tu[2] * tv[0] - tu[0] * tv[2], tu[0] * tv[1] - tu[1] * tv[0]];
      const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
      if (n[2] < 0) n = n.map((x) => -x);
      let s = 0, cnt = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        if (!di && !dj) continue;
        const q = at(i + di, j + dj);
        s += (P[q] - P[o]) * n[0] + (P[q + 1] - P[o + 1]) * n[1] + (P[q + 2] - P[o + 2]) * n[2]; cnt++;
      }
      const cav = Math.max(0, Math.min(1, (s / cnt) / (0.05 * sheetH)));       // 1 deep in a valley, 0 on a ridge or flat
      const m = (f * H * W + j * W + i) * 4;
      nrm[m] = Math.round((n[0] * 0.5 + 0.5) * 255); nrm[m + 1] = Math.round((n[1] * 0.5 + 0.5) * 255);
      nrm[m + 2] = Math.round((n[2] * 0.5 + 0.5) * 255); nrm[m + 3] = Math.round(cav * 255);
    }
  }
}

const head = Buffer.alloc(16);
head.write('CRMP', 0, 'ascii'); head.writeUInt32LE(FRAMES, 4); head.writeUInt32LE(W, 8); head.writeUInt32LE(H, 12);
fs.writeFileSync(outPath, Buffer.concat([head, Buffer.from(disp.buffer), Buffer.from(nrm.buffer)]));
console.log(`wrote ${outPath}: ${FRAMES} frames of ${W}x${H}, max displacement ${maxD.toFixed(3)} sheet heights, ${(fs.statSync(outPath).size / 1e6).toFixed(2)} MB`);
