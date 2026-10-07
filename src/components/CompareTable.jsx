import { useStore, BOARDS } from '../store/index.js';
import { ASICS } from '../data/index.js';

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

export function CompareTable() {
  const boardId = useStore(s => s.boardId);
  const pane = useStore(s => s.pane);
  const { setBoard, setPane } = useStore.getState();

  if (pane !== 'comp') return null;

  return (
    <div id="compare">
      <div className="comp-wrap">
        <h2 className="comp-title">Board comparison</h2>
        <p className="comp-sub">Hashrate at default frequency. Click any row to switch boards.</p>
        <div className="comp-scroll">
          <table className="comp-table">
            <thead>
              <tr>
                <th>Board</th><th>ASIC</th><th>Hashrate</th><th>Input</th><th>Core V</th><th>Cores</th><th>Chip origin</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(BOARDS).map(b => {
                const A = ASICS[b.asic.chip];
                const hr = (b.asic.def * A.smallCores * b.asic.count / 1e6).toFixed(2);
                const statVal = k => { const s = b.stats.find(([key]) => key === k); return s ? s[1] + (s[2] ? ' ' + s[2] : '') : '—'; };
                return (
                  <tr
                    key={b.id}
                    data-board={b.id}
                    className={b.id === boardId ? 'active-board' : ''}
                    onClick={() => { setPane('board'); setBoard(b.id); }}
                  >
                    <td>{b.tab}</td>
                    <td>{b.asic.chip}</td>
                    <td className="num">{hr} TH/s</td>
                    <td>{statVal('Input')}</td>
                    <td>{statVal('Core')}</td>
                    <td>{b.asic.count > 1 ? `${b.asic.count}× ` : ''}{A.cores} cores / {A.smallCores.toLocaleString()} small</td>
                    <td className="dim">{A.origin}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
