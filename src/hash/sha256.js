// SHA-256 implementation with step-by-step state capture for visualization.
// All arithmetic is unsigned 32-bit per the spec (>>> 0 truncates to uint32).

const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

const H0 = new Uint32Array([
  0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
]);

const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
const add  = (...vs) => vs.reduce((a, b) => (a + b) >>> 0);

// Pad a Uint8Array to a multiple of 64 bytes per SHA-256 spec.
export function pad(bytes) {
  const bitLen = bytes.length * 8;
  // append 0x80, then zeros, then 8-byte big-endian length
  const padLen = bytes.length % 64 < 56 ? 55 - (bytes.length % 64) : 119 - (bytes.length % 64);
  const out = new Uint8Array(bytes.length + 1 + padLen + 8);
  out.set(bytes);
  out[bytes.length] = 0x80;
  const dv = new DataView(out.buffer);
  dv.setUint32(out.length - 4, bitLen >>> 0, false);
  dv.setUint32(out.length - 8, Math.floor(bitLen / 2**32), false);
  return out;
}

// Parse 64-byte block into W[0..15] big-endian uint32s.
function parseBlock(padded, blockIdx) {
  const W = new Uint32Array(64);
  const dv = new DataView(padded.buffer, padded.byteOffset + blockIdx * 64, 64);
  for (let i = 0; i < 16; i++) W[i] = dv.getUint32(i * 4, false);
  for (let i = 16; i < 64; i++) {
    const s0 = rotr(W[i-15],7) ^ rotr(W[i-15],18) ^ (W[i-15] >>> 3);
    const s1 = rotr(W[i-2],17) ^ rotr(W[i-2],19)  ^ (W[i-2]  >>> 10);
    W[i] = add(W[i-16], s0, W[i-7], s1);
  }
  return W;
}

// Run the compression on one 64-byte block, recording every round.
// Returns { rounds: RoundStep[], outHash: Uint32Array }
function compressBlock(H, padded, blockIdx, recordSteps) {
  const W = parseBlock(padded, blockIdx);
  let [a, b, c, d, e, f, g, h] = H;
  const rounds = [];

  for (let t = 0; t < 64; t++) {
    const S1  = rotr(e,6)  ^ rotr(e,11) ^ rotr(e,25);
    const ch  = ((e & f) ^ (~e & g)) >>> 0;
    const S0  = rotr(a,2)  ^ rotr(a,13) ^ rotr(a,22);
    const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
    const T1  = add(h, S1, ch, K[t], W[t]);
    const T2  = add(S0, maj);

    if (recordSteps) {
      rounds.push({
        t,
        W: W[t], K: K[t],
        before: new Uint32Array([a,b,c,d,e,f,g,h]),
        S1, ch, T1, S0, maj, T2,
        after:  new Uint32Array([add(T1,T2), a, b, c, add(d,T1), e, f, g]),
      });
    }

    [a,b,c,d,e,f,g,h] = [add(T1,T2), a, b, c, add(d,T1), e, f, g];
  }

  const outHash = new Uint32Array(8);
  [a,b,c,d,e,f,g,h].forEach((v,i) => { outHash[i] = add(H[i], v); });
  return { rounds, outHash };
}

// Full SHA-256 of a Uint8Array. Returns Uint8Array (32 bytes).
export function sha256(bytes) {
  const padded = pad(bytes);
  let H = new Uint32Array(H0);
  for (let i = 0; i < padded.length / 64; i++) {
    H = compressBlock(H, padded, i, false).outHash;
  }
  const out = new Uint8Array(32);
  const dv = new DataView(out.buffer);
  H.forEach((v,i) => dv.setUint32(i*4, v, false));
  return out;
}

// Double SHA-256 (Bitcoin).
export function dsha256(bytes) { return sha256(sha256(bytes)); }

// Hex encode a Uint8Array.
export function toHex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2,'0')).join(''); }

// Hex to Uint8Array.
export function fromHex(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i*2, i*2+2), 16);
  return b;
}

// Build the 80-byte Bitcoin block header from its fields.
// All fields are little-endian integers except prevHash and merkleRoot (which are passed as hex strings).
export function buildHeader({ version, prevHash, merkleRoot, time, bits, nonce }) {
  const buf = new Uint8Array(80);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0,  version, true);
  buf.set(fromHex(prevHash).reverse(), 4);
  buf.set(fromHex(merkleRoot).reverse(), 36);
  dv.setUint32(68, time,  true);
  dv.setUint32(72, bits,  true);
  dv.setUint32(76, nonce, true);
  return buf;
}

// Step-through engine: records every round across all blocks of one SHA-256 pass.
export function sha256Trace(bytes) {
  const padded = pad(bytes);
  const numBlocks = padded.length / 64;
  let H = new Uint32Array(H0);
  const blocks = [];

  for (let i = 0; i < numBlocks; i++) {
    const { rounds, outHash } = compressBlock(H, padded, i, true);
    blocks.push({ blockIdx: i, rounds, inHash: new Uint32Array(H), outHash });
    H = outHash;
  }
  return { blocks, finalHash: H };
}

// Sample Bitcoin genesis block header fields (block #0).
export const GENESIS = {
  version:    1,
  prevHash:   '0000000000000000000000000000000000000000000000000000000000000000',
  merkleRoot: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
  time:       0x495FAB29,
  bits:       0x1D00FFFF,
  nonce:      2083236893,
};

// Build a header with a custom nonce so the miner can sweep.
export function headerWithNonce(fields, nonce) {
  return buildHeader({ ...fields, nonce });
}

// Count leading zero bits in a 32-byte hash.
export function leadingZeroBits(hashBytes) {
  let count = 0;
  for (const byte of hashBytes) {
    if (byte === 0) { count += 8; continue; }
    count += Math.clz32(byte) - 24;
    break;
  }
  return count;
}

// Format a uint32 as zero-padded hex.
export function u32hex(v) { return (v >>> 0).toString(16).padStart(8, '0'); }
