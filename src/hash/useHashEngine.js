import { useState, useEffect, useRef, useCallback } from 'react';
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

  // Trace: computed once per (fields, pass)
  const trace = useRef(null);
  const pass1Hash = useRef(null);  // 32-byte result of first SHA-256

  const rebuildTrace = useCallback(() => {
    const header = buildHeader({ ...fields, nonce: fields.nonce });
    if (pass === 0) {
      trace.current = sha256Trace(header);
    } else {
      if (!pass1Hash.current) {
        const { finalHash } = sha256Trace(header);
        const hashBytes = new Uint8Array(32);
        const dv = new DataView(hashBytes.buffer);
        finalHash.forEach((v, i) => dv.setUint32(i * 4, v, false));
        pass1Hash.current = hashBytes;
      }
      trace.current = sha256Trace(pass1Hash.current);
    }
  }, [fields, pass]);

  useEffect(() => {
    pass1Hash.current = null;
    rebuildTrace();
    setBlockIdx(0); setRound(0); setPlaying(false);
  }, [fields, pass]);

  // Derived from trace
  const currentBlock = trace.current?.blocks[blockIdx];
  const currentStep  = currentBlock?.rounds[round];
  const totalBlocks  = trace.current?.blocks.length ?? 0;
  const totalRounds  = currentBlock?.rounds.length ?? 64;

  // Playback
  const playRef = useRef(null);
  useEffect(() => {
    if (!playing) { clearInterval(playRef.current); return; }
    playRef.current = setInterval(() => {
      setRound(r => {
        if (r + 1 < totalRounds) return r + 1;
        clearInterval(playRef.current);
        setPlaying(false);
        return r;
      });
    }, 80);
    return () => clearInterval(playRef.current);
  }, [playing, totalRounds]);

  const stepForward = () => {
    if (round + 1 < totalRounds) { setRound(r => r + 1); return; }
    if (blockIdx + 1 < totalBlocks) { setBlockIdx(b => b + 1); setRound(0); return; }
    if (pass === 0) { setPass(1); setBlockIdx(0); setRound(0); }
  };
  const stepBack = () => {
    if (round > 0) { setRound(r => r - 1); return; }
    if (blockIdx > 0) { setBlockIdx(b => b - 1); setRound(totalRounds - 1); }
  };
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
          setFound({ nonce: n, hash: toHex(hash) });
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
    pass, setPass,
    blockIdx, setBlockIdx,
    round, setRound,
    playing, setPlaying,
    stepForward, stepBack, reset,
    currentStep, currentBlock,
    totalBlocks, totalRounds,
    trace: trace.current,

    // mine
    difficulty, setDifficulty,
    mining, setMining,
    nonce, hashRate, found,
  };
}
