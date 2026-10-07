import { useState } from 'react';
import { useHashEngine } from './useHashEngine.js';
import { u32hex } from './sha256.js';
import './HashEngine.css';

const VAR_NAMES = ['a','b','c','d','e','f','g','h'];

function WorkingVars({ vars, highlight = -1 }) {
  return (
    <div className="wv-grid">
      {VAR_NAMES.map((name, i) => (
        <div key={name} className={`wv-cell${highlight === i ? ' wv-hi' : ''}`}>
          <span className="wv-name">{name}</span>
          <span className="wv-val">{u32hex(vars[i])}</span>
        </div>
      ))}
    </div>
  );
}

function RoundDetail({ step }) {
  if (!step) return <div className="rd-empty">—</div>;
  return (
    <div className="rd-wrap">
      <div className="rd-row">
        <span className="rd-lbl">W[{step.t}]</span><span className="rd-val mono">{u32hex(step.W)}</span>
        <span className="rd-lbl">K[{step.t}]</span><span className="rd-val mono">{u32hex(step.K)}</span>
      </div>
      <div className="rd-row">
        <span className="rd-lbl">S1</span><span className="rd-val mono">{u32hex(step.S1)}</span>
        <span className="rd-lbl">Ch</span><span className="rd-val mono">{u32hex(step.ch)}</span>
        <span className="rd-lbl">T1</span><span className="rd-val mono rd-t">{u32hex(step.T1)}</span>
      </div>
      <div className="rd-row">
        <span className="rd-lbl">S0</span><span className="rd-val mono">{u32hex(step.S0)}</span>
        <span className="rd-lbl">Maj</span><span className="rd-val mono">{u32hex(step.maj)}</span>
        <span className="rd-lbl">T2</span><span className="rd-val mono rd-t">{u32hex(step.T2)}</span>
      </div>
    </div>
  );
}

function RoundScrubber({ round, total, onChange }) {
  return (
    <div className="rs-wrap">
      <span className="rs-label">Round {round + 1} / {total}</span>
      <input
        type="range" min={0} max={total - 1} value={round}
        onChange={e => onChange(Number(e.target.value))}
        className="rs-slider"
      />
    </div>
  );
}

function StepTab({ eng }) {
  const { currentStep, currentBlock, totalBlocks, totalRounds, blockIdx, round,
          setBlockIdx, setRound, playing, setPlaying, stepForward, stepBack, reset,
          pass, setPass } = eng;

  const pulse = () => window.__scene?.pulseAsic(0x00ff88, 120);

  const handleStep = dir => {
    if (dir > 0) stepForward(); else stepBack();
    pulse();
  };

  return (
    <div className="he-step">
      <div className="he-pass-bar">
        <button className={pass === 0 ? 'active' : ''} onClick={() => setPass(0)}>Pass 1: SHA-256</button>
        <button className={pass === 1 ? 'active' : ''} onClick={() => setPass(1)}>Pass 2: SHA-256</button>
      </div>

      {totalBlocks > 1 && (
        <div className="he-block-nav">
          {Array.from({ length: totalBlocks }, (_, i) => (
            <button key={i} className={i === blockIdx ? 'active' : ''} onClick={() => { setBlockIdx(i); setRound(0); }}>
              Block {i}
            </button>
          ))}
        </div>
      )}

      {currentBlock && (
        <div className="he-inhash">
          <div className="he-label">Input H (before block {blockIdx})</div>
          <WorkingVars vars={currentBlock.inHash} />
        </div>
      )}

      {currentStep && (
        <>
          <div className="he-label">Before round {round}</div>
          <WorkingVars vars={currentStep.before} />
        </>
      )}

      <RoundDetail step={currentStep} />

      {currentStep && (
        <>
          <div className="he-label">After round {round}</div>
          <WorkingVars vars={currentStep.after} highlight={0} />
        </>
      )}

      <RoundScrubber round={round} total={totalRounds} onChange={r => { setRound(r); pulse(); }} />

      <div className="he-controls">
        <button onClick={reset} title="Reset">↩</button>
        <button onClick={() => handleStep(-1)} title="Step back">‹</button>
        <button className={playing ? 'active' : ''} onClick={() => setPlaying(p => !p)} title={playing ? 'Pause' : 'Play'}>
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => handleStep(1)} title="Step forward">›</button>
      </div>

      {currentBlock && (
        <div className="he-outhash">
          <div className="he-label">Output H (after block {blockIdx})</div>
          <WorkingVars vars={currentBlock.outHash} />
        </div>
      )}
    </div>
  );
}

function MineTab({ eng }) {
  const { fields, setFields, difficulty, setDifficulty, mining, setMining, nonce, hashRate, found } = eng;
  const [showFields, setShowFields] = useState(false);

  return (
    <div className="he-mine">
      <div className="he-mine-row">
        <label>Difficulty (leading zero bits)</label>
        <input type="number" min={1} max={48} value={difficulty}
          onChange={e => setDifficulty(Number(e.target.value))} className="he-diff-in" />
      </div>

      <button className={`he-mine-btn${mining ? ' mining' : ''}`} onClick={() => setMining(m => !m)}>
        {mining ? '⏹ Stop Mining' : '⛏ Start Mining'}
      </button>

      <div className="he-mine-stats">
        <div><span>Nonce</span><code>{nonce.toLocaleString()}</code></div>
        <div><span>Hash/s</span><code>{hashRate.toLocaleString()}</code></div>
      </div>

      {found && (
        <div className="he-found">
          <div className="he-found-title">✓ Block found!</div>
          <div><span>Nonce</span><code>{found.nonce.toLocaleString()}</code></div>
          <div className="he-found-hash">
            <span>Hash</span>
            <code className="he-hash-val">{found.hash}</code>
          </div>
        </div>
      )}

      <details open={showFields} onToggle={e => setShowFields(e.target.open)}>
        <summary className="he-field-toggle">Block header fields</summary>
        <div className="he-fields">
          {[
            ['version', 'Version', 'number'],
            ['time',    'Timestamp', 'number'],
            ['bits',    'Bits (target)', 'number'],
            ['nonce',   'Start nonce', 'number'],
            ['prevHash',   'Prev hash', 'text'],
            ['merkleRoot', 'Merkle root', 'text'],
          ].map(([key, label, type]) => (
            <div key={key} className="he-field">
              <label>{label}</label>
              <input
                type={type}
                value={fields[key]}
                onChange={e => setFields(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
              />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export function HashEngine() {
  const eng = useHashEngine();
  const { mode, setMode } = eng;

  return (
    <div className="hash-engine">
      <div className="he-header">
        <span className="he-title">SHA-256 Engine</span>
        <div className="he-tabs">
          <button className={mode === 'step' ? 'active' : ''} onClick={() => setMode('step')}>Step-through</button>
          <button className={mode === 'mine' ? 'active' : ''} onClick={() => setMode('mine')}>Mine</button>
        </div>
      </div>
      {mode === 'step' ? <StepTab eng={eng} /> : <MineTab eng={eng} />}
    </div>
  );
}
