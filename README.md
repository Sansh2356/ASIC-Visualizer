# Bitaxe Gamma Explorer

Interactive 3D visualizer of the Bitaxe Gamma (BM1370) board, with Free and Guided modes.

## Run
Open `index.html` in a browser. three.js is bundled in `js/vendor`, so it works offline
(fonts fall back to system fonts without internet). If your browser blocks local files,
serve the folder instead: `python3 -m http.server 8000` and open http://localhost:8000

## Files
- `index.html`: page layout (header, controls, 3D stage, inspector)
- `css/styles.css`: theme tokens and layout
- `js/data.js`: board data: PARTS, PASSIVES, test points, holes, BM1370 pins, FLOWS, TOUR steps
- `js/app.js`: three.js scene, board/part models, picking, labels, inspector, guided tour, block diagram
- `js/vendor/`: three.js r147 and OrbitControls (MIT licence)

## Editing
- To add or fix a component, edit its entry in `js/data.js`. Coordinates are KiCad millimetres from bitaxeGamma.kicad_pcb.
- To change the tour, edit the `TOUR` array in `js/data.js`.

## Sources
- https://www.bitaxe.org/hardware
- https://github.com/bitaxeorg/bitaxeGamma (design files, rev 601)
- https://github.com/bitaxeorg/ESP-Miner (firmware values)
