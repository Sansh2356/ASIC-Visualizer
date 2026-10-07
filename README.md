# Miner Board Explorer

Interactive 3D visualizer of open-source Bitcoin miner boards. Explore each board in Free or Guided Tour mode, inspect every component, compare specs across boards, and step through the SHA-256 double-hash that runs on the ASIC.

| Board | ASICs | Source |
|---|---|---|
| Bitaxe Gamma (`#gamma`) | 1 × BM1370 | bitaxeorg/bitaxeGamma rev 601 |
| Bitaxe Supra (`#supra`) | 1 × BM1368 | bitaxeorg/bitaxeSupra rev 403 |
| Bitaxe Ultra (`#ultra`) | 1 × BM1366 | bitaxeorg/bitaxeUltra rev 205 |
| Bitaxe Max (`#max`) | 1 × BM1397 | bitaxeorg/bitaxeMax v2.2 |
| Bitaxe Gamma Turbo (`#gt`) | 2 × BM1370 | bitaxeorg/BitaxeGT rev 801 |
| Bitaxe Gamma Hex (`#hex`) | 6 × BM1370 | bitaxeorg/BitaxeGammaHex rev 1300 |
| NerdQAxe+ (`#nerdqaxep`) | 4 × BM1368 | shufps/qaxe nerdqaxe+ rev 5.0 |
| NerdQAxe++ (`#nerdqaxepp`) | 4 × BM1370 | shufps/qaxe nerdqaxe++ rev 5.1.2 |

## Run

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

## Tech stack

| Layer | Library |
|---|---|
| UI framework | React 19 + Vite 8 |
| 3D rendering | Three.js 0.172 |
| State | Zustand 5 (`subscribeWithSelector`) |

The Three.js scene lives as an imperative class (`src/scene/scene.js`) that subscribes to the Zustand store for board/visibility changes and publishes `_objs` back to the store after each board load, keeping React components reactive without polling.

## SHA-256 simulation

Click the ASIC chip (U8) on any board to open the SHA-256 engine in the inspector panel. It models the full Bitcoin double-hash (`SHA256(SHA256(header))`):

- **Step-through**: scrub or play through all 64 compression rounds of each 512-bit block, watching working variables `a–h` update each round with W, K, T1, and T2 shown explicitly.
- **Mine mode**: sweeps nonces across the Bitcoin genesis block header until a hash meeting the configured difficulty (leading zero bits) is found. Hash rate is displayed live. The ASIC mesh in the 3D view glows on each discovery.

The engine (`src/hash/sha256.js`) is a self-contained, spec-correct SHA-256 implementation with no external dependencies, verified against NIST test vectors and the Bitcoin genesis block hash.

## Project layout

```
src/
  main.jsx            entry point, mounts React root
  App.jsx             top-level layout, hash routing, theme sync
  store/index.js      Zustand store (board state, UI mode, selected part)
  scene/
    scene.js          imperative Three.js scene class
    useScene.js       React hook that owns the Scene lifecycle
  components/
    Header.jsx        board tabs, mode/view buttons, theme toggle
    Sidebar.jsx       camera controls, display options, flow toggles, part list
    Inspector.jsx     component detail, hashrate calc, pinout SVG
    Stage.jsx         canvas, labels, tooltip, legend, tour, compare table
    Tour.jsx          guided tour step controller
    CompareTable.jsx  side-by-side spec comparison
  hash/
    sha256.js         SHA-256 + double-hash + step-trace engine
    useHashEngine.js  step-through and mine state hook
    HashEngine.jsx    SHA-256 visualizer UI (step + mine tabs)
    HashEngine.css    styles for the hash engine panel
  data/
    index.js          GROUPS, ASICS, PKG, ESPM, BOARDS, registerBoard
    boards.js         barrel import triggering all registerBoard() calls
    gamma.js … (×8)  one file per board: PARTS, FLOWS, TOUR, overview, diagram

css/styles.css        theme tokens (CSS custom properties), global layout
tools/
  check-data.js       consistency checks (duplicate refs, off-board coords, …)
  kicad-extract.js    extracts footprints from a .kicad_pcb file
```

## Deep-link URL format

`#<boardId>` — load a board (e.g. `#gamma`)  
`#<boardId>/<ref>` — load a board and select a component (e.g. `#gamma/U8`)

## Editing board data

- Component definitions live in `src/data/<id>.js`. Coordinates are KiCad millimetres from the board's `.kicad_pcb`.
- `topLayer` sets which KiCad copper side is shown as "top" (single-chip Bitaxes use `B`; GT, Hex and NerdQAxes use `F`).
- Add a `short` field to show a 3D label for a part; add `face` if the model has a one-sided feature (antenna, plug opening, USB port).
- After editing, run `node tools/check-data.js` to catch duplicate refs, off-board coordinates, unknown tour refs, and missing flow IDs.

## Adding a board

1. Run `node tools/kicad-extract.js path/to/board.kicad_pcb > footprints.json` to get positions, sizes, and nets.
2. Copy `src/data/nerdqaxepp.js` to `src/data/<id>.js` and fill it in. Descriptions come from the schematic and firmware source.
3. If the board uses a new ASIC, add its pinout and small-core count to `ASICS` in `src/data/index.js`.
4. Add `import './<id>.js'` to `src/data/boards.js`. The board tab appears automatically.

## Sources

- https://www.bitaxe.org/hardware
- https://github.com/bitaxeorg/bitaxeGamma (rev 601)
- https://github.com/bitaxeorg/bitaxeSupra (rev 403), https://github.com/bitaxeorg/bitaxeUltra (rev 205), https://github.com/bitaxeorg/bitaxeMax (v2.2)
- https://github.com/bitaxeorg/BitaxeGT (rev 801), https://github.com/bitaxeorg/BitaxeGammaHex (rev 1300)
- https://github.com/bitaxeorg/ESP-Miner (Bitaxe firmware values)
- https://github.com/shufps/qaxe (NerdQAxe+ rev 5.0 and NerdQAxe++ rev 5.1.2)
- https://github.com/shufps/ESP-Miner-NerdQAxePlus (NerdQAxe firmware values)
