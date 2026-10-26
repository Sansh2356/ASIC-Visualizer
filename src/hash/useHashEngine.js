import { useState, useEffect, useRef, useMemo } from 'react';
import { sha256Trace, dsha256, buildHeader, headerWithNonce, leadingZeroBits, toHex, GENESIS } from './sha256.js';

const DEFAULT_FIELDS = { ...GENESIS };

export function useHashEngine() {
  const [mode, setMode]         = useState('step');   // 'step' | 'mine'
  const [fields, setFields]     = useState(DEFAULT_FIELDS);
  const [pass, setPass]         = useState(0);        // 0 = first SHA-256, 1 = second SHA-256
  const [blockIdx, setBlockIdx] = useState(0);
  const [round, setRound]       = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [difficulty, setDifficulty] = useState(16);  // leading zero bits required

  // Mine state
  const [mining, setMining]     = useState(false);
  const [nonce, setNonce]       = useState(0);
  const [hashRate, setHashRate] = useState(0);
  const [found, setFound]       = useState(null);     // { nonce, hash } or null

  // Traces for both passes: always fresh — useMemo ensures no stale read on the render after a field change
  const traces = useMemo(() => {
    const first = sha256Trace(buildHeader({ ...fields, nonce: fields.nonce }));
    // Pass 2: hash the output of pass 1
    const pass1Bytes = new Uint8Array(32);
    const dv = new DataView(pass1Bytes.buffer);
    first.finalHash.forEach((v, i) => dv.setUint32(i * 4, v, false));
    return [first, sha256Trace(pass1Bytes)];
  }, [fields]);
  const trace = traces[pass];

  // Reset position when the header fields change
  useEffect(() => {
    setBlockIdx(0); setRound(0); setPlaying(false);
  }, [fields]);

  // Derived from trace
  const currentBlock = trace.blocks[blockIdx];
  const currentStep  = currentBlock?.rounds[round];
  const totalBlocks  = trace.blocks.length;
  const totalRounds  = currentBlock?.rounds.length ?? 64;

  const selectPass = p => { setPass(p); setBlockIdx(0); setRound(0); };

  const stepForward = () => {
    if (round + 1 < totalRounds) { setRound(r => r + 1); return; }
    if (blockIdx + 1 < totalBlocks) { setBlockIdx(b => b + 1); setRound(0); return; }
    if (pass === 0) selectPass(1);
  };
  const stepBack = () => {
    if (round > 0) { setRound(r => r - 1); return; }
    if (blockIdx > 0) { setBlockIdx(blockIdx - 1); setRound(trace.blocks[blockIdx - 1].rounds.length - 1); return; }
    if (pass === 1) {
      const last = traces[0].blocks.length - 1;
      setPass(0); setBlockIdx(last); setRound(traces[0].blocks[last].rounds.length - 1);
    }
  };

  // Playback: one stepForward per tick, so it crosses block and pass boundaries
  const atEnd = pass === 1 && blockIdx + 1 >= totalBlocks && round + 1 >= totalRounds;
  useEffect(() => {
    if (!playing) return;
    if (atEnd) { setPlaying(false); return; }
    const t = setTimeout(stepForward, 80);
    return () => clearTimeout(t);
  }, [playing, pass, blockIdx, round]);
  const reset = () => { setBlockIdx(0); setRound(0); setPlaying(false); setPass(0); };

  // Mining loop — runs in the main thread with chunked rAF to stay responsive
  const mineRef = useRef(null);
  useEffect(() => {
    if (!mining) { cancelAnimationFrame(mineRef.current); return; }
    setFound(null);
    let n = 0;
    let t0 = performance.now(), hashes = 0;

    const chunk = () => {
      const BATCH = 500;
      for (let i = 0; i < BATCH; i++) {
        const header = headerWithNonce(fields, n);
        const hash   = dsha256(header);
        hashes++;
        // Bitcoin displays hashes byte-reversed; check difficulty on display-order bytes
        if (leadingZeroBits(hash.slice().reverse()) >= difficulty) {
          setFound({ nonce: n, hash: toHex(hash.slice().reverse()) });
          setNonce(n);
          setMining(false);
          // Pulse scene ASIC on discovery
          window.__scene?.pulseAsic(0xffd700, 800);
          return;
        }
        n++;
      }
      setNonce(n);
      const elapsed = performance.now() - t0;
      if (elapsed > 400) {
        setHashRate(Math.round(hashes / (elapsed / 1000)));
        hashes = 0; t0 = performance.now();
      }
      mineRef.current = requestAnimationFrame(chunk);
    };
    mineRef.current = requestAnimationFrame(chunk);
    return () => cancelAnimationFrame(mineRef.current);
  }, [mining, fields, difficulty]);

  return {
    // step-through
    mode, setMode,
    fields, setFields,
    pass, setPass: selectPass,
    blockIdx, setBlockIdx,
    round, setRound,
    playing, setPlaying,
    stepForward, stepBack, reset,
    currentStep, currentBlock,
    totalBlocks, totalRounds,
    trace,

    // mine
    difficulty, setDifficulty,
    mining, setMining,
    nonce, hashRate, found,
  };
}
