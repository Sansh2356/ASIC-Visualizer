import { useState } from 'react';
import { useStore, BOARDS } from '../store/index.js';
import { GROUPS } from '../data/index.js';

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

export function Sidebar({ sceneRef }) {
  const board = useStore(s => BOARDS[s.boardId]);
  const selected = useStore(s => s.selected);
  const showLabels = useStore(s => s.showLabels);
  const showPassives = useStore(s => s.showPassives);
  const showOled = useStore(s => s.showOled);
  const showCool = useStore(s => s.showCool);
  const explode = useStore(s => s.explode);
  const xray = useStore(s => s.xray);
  const showTP = useStore(s => s.showTP);
  const colorBy = useStore(s => s.colorBy);
  const activeFlows = useStore(s => s.activeFlows);
  const cameraView = useStore(s => s.cameraView);
  const { setOption, setCameraView, toggleFlow } = useStore.getState();

  const objs = useStore(s => s._objs);
  const [search, setSearch] = useState('');

  if (!board) return null;

  const allItems = Object.values(objs).map(o => o.data).filter(d => d.ref);

  const q = search.trim().toLowerCase();
  const filtered = allItems.filter(d =>
    !q || [d.ref, d.name, d.part || '', d.what || '', d.netsStr || ''].join(' ').toLowerCase().includes(q)
  );
  const order = ['asic', 'power', 'control', 'thermal', 'io', 'passive', 'test', 'mech'];

  return (
    <aside className="left" aria-label="Controls and component list">
      <section>
        <details>
          <summary className="label">Camera</summary>
          <div className="views">
            {['iso', 'top', 'bottom', 'edge'].map(v => (
              <button
                key={v}
                data-view={v}
                aria-pressed={cameraView === v}
                onClick={() => {
                  setCameraView(v);
                  sceneRef?.current?.setView(v);
                }}
              >{v === 'iso' ? 'Isometric' : v === 'top' ? 'Top side' : v === 'bottom' ? 'Bottom side' : 'Edge on'}</button>
            ))}
          </div>
        </details>
      </section>

      <section>
        <details>
          <summary className="label">Display</summary>
          <div className="opts">
            <label className="opt"><input type="checkbox" checked={showLabels} onChange={e => setOption('showLabels', e.target.checked)} /> Labels</label>
            <label className="opt"><input type="checkbox" checked={showPassives} onChange={e => setOption('showPassives', e.target.checked)} /> Passives (R / C)</label>
            {board.oled && (
              <label className="opt"><input type="checkbox" checked={showOled} onChange={e => setOption('showOled', e.target.checked)} /> OLED display</label>
            )}
            <label className="opt"><input type="checkbox" checked={showCool} onChange={e => setOption('showCool', e.target.checked)} /> Heatsink + fan</label>
            <div className="opts-divider" aria-hidden="true" />
            <label className="opt muted"><input type="checkbox" checked={explode} onChange={e => setOption('explode', e.target.checked)} /> Exploded view</label>
            <label className="opt muted"><input type="checkbox" checked={xray} onChange={e => setOption('xray', e.target.checked)} /> X-ray PCB</label>
            <label className="opt muted"><input type="checkbox" checked={showTP} onChange={e => setOption('showTP', e.target.checked)} /> Test points</label>
            <label className="opt muted"><input type="checkbox" checked={colorBy} onChange={e => setOption('colorBy', e.target.checked)} /> Colour by subsystem</label>
          </div>
        </details>
      </section>

      <section>
        <details open>
          <summary className="label">Signal &amp; power flows</summary>
          <div className="opts">
            {board.FLOWS.map(f => (
              <label key={f.id} className="opt">
                <input
                  type="checkbox"
                  id={`f_${f.id}`}
                  checked={activeFlows.includes(f.id)}
                  onChange={() => toggleFlow(f.id)}
                />
                <span className="sw" style={{ background: f.color }} />
                {f.name}
              </label>
            ))}
          </div>
        </details>
      </section>

      <section className="section-components">
        <p className="label">Components</p>
        <input
          className="search"
          type="search"
          placeholder="Search ref, part or function"
          aria-label="Search components"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div id="list">
          {order.map(gk => {
            const its = filtered.filter(d => d.group === gk).sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
            if (!its.length) return null;
            return (
              <div key={gk} className="group">
                <h4>
                  <i style={{ background: `var(${GROUPS[gk].color})` }} />
                  {GROUPS[gk].name}
                  <small>{its.length}</small>
                </h4>
                {its.map(d => (
                  <button
                    key={d.ref}
                    className="item"
                    data-ref={d.ref}
                    aria-current={d.ref === selected}
                    onClick={() => {
                      useStore.getState().select(d.ref);
                      sceneRef?.current?.select(d.ref, { fly: true });
                    }}
                  >
                    <code>{d.ref}</code>
                    <span dangerouslySetInnerHTML={{ __html: esc(d.passive ? d.name + ' · ' + (d.netsStr || '') : d.name) }} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

