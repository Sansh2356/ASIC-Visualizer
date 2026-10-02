# Miner Board Explorer

Interactive 3D visualizer of open-source Bitcoin miner boards, with Free and Guided modes.
Use the board switch in the header to pick a board. The URL hash selects one directly,
e.g. `index.html#nerdqaxepp`.

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
Open `index.html` in a browser. three.js is bundled in `js/vendor`, so it works offline
(fonts fall back to system fonts without internet). If your browser blocks local files,
serve the folder instead: `python3 -m http.server 8000` and open http://localhost:8000

## Files
- `index.html`: page layout (header, controls, 3D stage, inspector) and the list of board scripts
- `css/styles.css`: theme tokens and layout
- `js/data.js`: shared data: subsystem groups, passive packages, ASIC facts (pinout, cores), `registerBoard()`
- `js/boards/<id>.js`: one file per board: PARTS, PASSIVES, test points, holes, FLOWS, TOUR steps, board art, cooler, overview and block diagram
- `js/app.js`: three.js scene, part models, picking, labels, inspector, guided tour, block diagram, board switching
- `js/vendor/`: three.js r147 and OrbitControls (MIT licence)
- `tools/check-data.js`: consistency checks for every board
- `tools/kicad-extract.js`: dumps footprints (position, rotation, side, courtyard size, nets) from a `.kicad_pcb`

## Editing
- To add or fix a component, edit its entry in the board's file. Coordinates are KiCad millimetres from that board's `.kicad_pcb`.
- `topLayer` says which KiCad copper side is shown as "top" (the single-chip Bitaxes use `B`; the GT, Hex and NerdQAxes use `F`).
- On the NerdQAxe+ the KiCad net for the ASIC core rail is named `+1V2`; it is VDD (≈1.25 V), not an I/O rail.
- Give a part a `short` field to show a 3D label for it, and a `face` if its model has a one-sided feature (antenna, plug opening, USB end).
- After editing data, run `node tools/check-data.js`. It catches duplicate refs, off-board coordinates, unknown tour refs/flows and similar mistakes.

## Adding a board
1. Run `node tools/kicad-extract.js path/to/board.kicad_pcb > footprints.json` for positions, sizes and nets.
2. Copy `js/boards/nerdqaxepp.js` to `js/boards/<id>.js` and fill it in. Descriptions come from the schematic and the board's firmware.
3. If the board uses a new ASIC, add its pinout and small-core count to `ASICS` in `js/data.js`.
4. Add a `<script>` tag for the file in `index.html`. The switch button appears automatically.

## Sources
- https://www.bitaxe.org/hardware
- https://github.com/bitaxeorg/bitaxeGamma (design files, rev 601)
- https://github.com/bitaxeorg/bitaxeSupra (rev 403), https://github.com/bitaxeorg/bitaxeUltra (rev 205), https://github.com/bitaxeorg/bitaxeMax (v2.2)
- https://github.com/bitaxeorg/BitaxeGT (rev 801), https://github.com/bitaxeorg/BitaxeGammaHex (rev 1300)
- https://github.com/bitaxeorg/ESP-Miner (Bitaxe firmware values)
- https://github.com/shufps/qaxe (NerdQAxe+ rev 5.0 and NerdQAxe++ rev 5.1.2 design files)
- https://github.com/shufps/ESP-Miner-NerdQAxePlus (NerdQAxe firmware values)
