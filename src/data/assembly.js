import { BOARDS } from "./index.js";

/* ====================================================================
   Assembly guides, one ordered list of steps per board.
   A step uses the same camera fields as a TOUR step (refs, side, cool,
   explode, flows) plus:
     do  = what to do, in order
     qa  = [question, answer] pairs ("Common questions")
     fix = [symptom, what to check] pairs ("Troubleshooting")
   Facts come from the board data files and the upstream READMEs
   (bitaxeorg/bitaxeGamma, bitaxeorg/ESP-Miner, shufps/qaxe). Boards
   without a verified guide are left out rather than guessed.
   ==================================================================== */

// AxeOS setup and pool steps are shared by every ESP-Miner board.
const wifiStep = (refs, side, screen) => ({
  t: "First boot and Wi-Fi setup", refs, side, flows: [],
  do: [
    `On first boot the miner starts its own Wi-Fi hotspot. Its name is shown on the ${screen}.`,
    "Join that hotspot from a phone or laptop. The setup page usually opens on its own; if it doesn't, browse to 192.168.4.1.",
    "Pick your home network, enter its password, then Save and Restart.",
    "After it joins your network, open AxeOS at the IP shown on the screen, or at http://bitaxe if your network supports mDNS.",
  ],
  qa: [
    ["Does it work on 5 GHz Wi-Fi?", "No. The ESP32-S3 radio is 2.4 GHz only. If your router merges both bands under one name, a separate 2.4 GHz or guest network usually helps."],
    ["What do I use to reach the dashboard?", "Any browser on the same network. ESP-Miner serves AxeOS at http://<IP>, or at http://bitaxe with mDNS."],
  ],
  fix: [
    ["It never joins my network", "Check the password and that the network is 2.4 GHz. ESP-Miner's README notes that some routers, such as some ASUS and TP-Link models, block mining traffic."],
    ["I can't find the hotspot", "Power-cycle the board and read the hotspot name off the screen again."],
  ],
});

const poolStep = (refs, side, expect) => ({
  t: "Enter your pool settings", refs, side, flows: [],
  do: [
    "In AxeOS, open Settings and fill in the Stratum URL and port from your pool.",
    "Set the Stratum user. Most pools expect your Bitcoin address or account, often followed by .workername.",
    "Save and restart. After a minute the dashboard shows hashrate and accepted shares.",
  ],
  qa: [
    ["Which pool should I use?", "Any Stratum V1 pool works. Solo pools pay only if this miner finds a whole block; shared pools pay in small amounts for shares."],
    ["What hashrate should I see?", expect],
  ],
  fix: [
    ["No shares are accepted", "Check the Stratum URL, port and user for typos, and that the pool is reachable from your network."],
  ],
});

const GAMMA = [
  { t: "Inspect the finished board", refs: [], side: "iso", flows: [],
    do: [
      "Look at both sides of the finished board under good light.",
      "Top side: the ESP32-S3 module (U4), the BM1370 ASIC (U8), the barrel jack, USB-C and fan header. Bottom side: the power stage.",
      "Look for cracked parts, solder bridges, and bent pins on the fan header J6.",
    ],
    qa: [
      ["Which side is up?", "The top is the side with the ESP32, the ASIC and the connectors. The heatsink goes on this side."],
      ["Is this a kit I have to solder?", "The bitaxeGamma README calls a full build an advanced project with parts on both sides. It suggests buying one pre-assembled unless you want a soldering project; then you only add the heatsink, fan and power."],
    ],
    fix: [] },
  { t: "Apply thermal paste to the ASIC", refs: ["U8"], side: "top", flows: [],
    do: [
      "Clean the top of U8 and the heatsink base with isopropyl alcohol and let them dry.",
      "Put a small amount of good thermal paste on the chip. The project suggests Thermal Grizzly Kryonaut.",
    ],
    qa: [
      ["How much paste?", "Just enough to cover the chip in a thin layer once the heatsink presses down. The chip is only about 8.6 × 7.8 mm, so a small dot is enough. Too much does not cool better."],
      ["Paste or a thermal pad?", "The Gamma design uses thermal paste between the chip and heatsink. The project does not specify a pad."],
    ],
    fix: [
      ["The chip runs hot even with the fan on", "Take the heatsink off and look at the paste. If it doesn't cover the whole chip, or there are bare patches, clean it and reapply."],
    ] },
  { t: "Mount the heatsink", place: ["HS1"], refs: ["U8", "H5", "H6", "H7", "H8"], side: "iso", cool: true, flows: [],
    do: [
      "Place the 40 × 40 mm heatsink square on the ASIC.",
      "Clamp it through the four 3.5 mm holes around the chip (H5–H8).",
      "Tighten in a cross pattern, a little at a time, so the heatsink sits flat with even pressure.",
    ],
    qa: [
      ["Do I really need the fan?", "Yes. The bitaxeGamma README says the heatsink alone is not enough, and the board draws about 20 W."],
    ],
    fix: [
      ["The heatsink rocks or tilts", "Loosen all four screws and tighten them again in a cross pattern. The heatsink must sit flat on the chip."],
    ] },
  { t: "Mount the fan and plug it into J6", place: ["HS1:fan"], refs: ["J6"], side: "top", flows: ["thermal"],
    do: [
      "Fix a 40 mm, 5 V, 4-pin PWM fan on top of the heatsink so it blows onto the fins.",
      "Plug the fan cable into J6. The silkscreen next to it reads PWM · TAC · 5V · GND.",
    ],
    qa: [
      ["Which way does the fan cable go?", "J6 is a keyed 4-pin header (Molex 0470531000), so the plug fits only one way. Line up the plug's ridge with the header's guide and don't force it. The pins are GND, 5 V, tach and PWM, matching the silkscreen."],
      ["Can I use a 12 V fan?", "No. The README says to use a 5 V fan. A 40 × 40 × 20 mm fan fits the suggested heatsink, and the Noctua NF-A4x10 5V PWM is suggested as a quieter option."],
      ["What is J7?", "An alternative fan connector (JST-SH) wired in parallel with J6. Many boards leave it unpopulated."],
    ],
    fix: [
      ["The fan doesn't spin", "Check that the plug is fully seated on J6 and that the fan is a 5 V model. The EMC2101 (U10) drives the PWM line and reads RPM from the tach."],
      ["AxeOS shows 0 RPM but the fan spins", "The fan's tach wire is not reaching U10. Use a 4-pin fan with a tach output."],
    ] },
  { t: "Check the power supply", refs: ["J1"], side: "top", flows: ["core"],
    do: [
      "Use a 5 V DC supply only. The README warns that anything else will damage the board.",
      "It must deliver more than 4 A (20 W) without dropping below 5 V. In practice, buy one rated 25–30 W.",
      "The plug is a 5.5 × 2.1 mm barrel, centre positive.",
    ],
    qa: [
      ["Can I power it from USB-C?", "No. J5 carries USB data only, for flashing and logs. Power comes in through J1."],
      ["Can I use a 12 V adapter?", "No. The Gamma is 5 V only."],
    ],
    fix: [
      ["It reboots or stops under load", "The supply is sagging. The core regulator starts at 4.8 V input and stops below 4.5 V, so a weak adapter shuts it down once hashing starts."],
    ] },
  { t: "Connect power", refs: ["J1", "U2"], side: "top", flows: ["core"],
    do: [
      "Check that the fan is plugged in before you power up.",
      "Plug the 5 V supply into J1. If an OLED is fitted on J3, it lights up within a few seconds.",
    ],
    qa: [
      ["What do the two buttons do?", "RESET (SW1) restarts the ESP32. BOOT (SW2) pulls GPIO0 low for bootloader recovery when you reflash the firmware."],
    ],
    fix: [
      ["Nothing happens at power-on", "Check the adapter's voltage and polarity (centre positive), and try a known-good 5 V supply that can deliver more than 4 A."],
      ["It won't connect to a USB-C port for flashing", "ESP-Miner's README notes that some Bitaxe versions can't connect directly to a USB-C port. Use a USB-A port with an adapter."],
    ] },
  wifiStep(["U4", "J3"], "top", "OLED (J3)"),
  poolStep(["U4"], "top", "About 1.07 TH/s at the 525 MHz default, and around 1.2 TH/s when tuned. The hashrate calculator on the ASIC shows other frequencies."),
];
// Gamma troubleshooting for a running miner goes on the last step.
GAMMA[GAMMA.length - 1].fix.push(
  ["The hashrate is low", "Check the ASIC temperature. Above 75 °C the firmware enters overheat mode and lowers voltage and frequency to protect the chip. Improve the paste, heatsink pressure or fan."],
  ["It runs hot", "Above 105 °C on the core regulator the miner also drops into overheat mode. Check that the fan reports RPM, that air reaches the fins, and that the room isn't too warm."],
);

const HEX_ASICS = ["A1", "A2", "A3", "A4", "A5", "A6"];
const HEX = [
  { t: "Inspect the finished board", refs: [], side: "iso", flows: [],
    do: [
      "Look at both sides under good light.",
      "Front: the six BM1370 ASICs (A1–A6) that share one heatsink. Back: the ESP32-S3, the four-phase power stage, the fan headers and the 12 V input.",
      "Look for cracked parts, solder bridges, and bent pins on the fan headers and the power connector.",
    ],
    qa: [
      ["Why six chips in two groups?", "They are wired as two stacked domains of three. Each chip sees about 1.2 V while the regulator supplies about 2.4 V at half the current."],
    ],
    fix: [] },
  { t: "Apply thermal paste to all six ASICs", refs: HEX_ASICS, side: "top", flows: [],
    do: [
      "Clean the top of every chip and the heatsink base with isopropyl alcohol.",
      "Put a small amount of paste on each of A1–A6. All six must make contact with the heatsink.",
    ],
    qa: [
      ["How much paste per chip?", "A thin layer that covers each chip once the heatsink presses down. Each chip is small, so a small dot each is enough."],
    ],
    fix: [
      ["One chip is much hotter than the others", "That chip is not touching the heatsink well. Check the paste spread and that the heatsink sits flat across all six."],
    ] },
  { t: "Mount the heatsink", place: ["HS1"], refs: HEX_ASICS, side: "iso", cool: true, flows: [],
    do: [
      "Place the heatsink over the six-chip area so it covers A1–A6.",
      "Fit it with the hardware supplied with your heatsink, tightening evenly so it sits flat.",
    ],
    qa: [
      ["Which heatsink fits?", "The board has no heatsink footprint, so the heatsink and fan in this view are generic stand-ins sized to the ASIC area. Use the heatsink your board's vendor supplies."],
    ],
    fix: [] },
  { t: "Plug in the fans", place: ["HS1:fan"], refs: ["J3", "J6", "J7"], side: "bottom", flows: ["thermal"],
    do: [
      "Use 12 V, 4-pin PWM fans.",
      "Plug the main fan into J3. Add more fans on J6 and J7 if you use them.",
    ],
    qa: [
      ["Which fan header should I use first?", "J3. All three headers share one PWM signal from the EMC2103 (U16), but only J3's tach line is connected, so it is the fan whose RPM AxeOS reports."],
      ["Which way does the fan cable go?", "The headers are keyed 4-pin Molex 0470531000 parts, so the plug fits only one way. The pins are GND, 12 V, tach and PWM."],
      ["Can I use a 5 V fan?", "No. The Hex fan headers supply 12 V."],
    ],
    fix: [
      ["AxeOS shows 0 RPM", "Only J3 reports RPM. Move the fan with a tach wire to J3."],
    ] },
  { t: "Connect the display", refs: ["J2"], side: "bottom", flows: ["lcd"],
    do: [
      "The 1.9\" colour LCD plugs into the 30-pin flat-flex connector J2.",
      "Open the connector latch, slide the ribbon fully in, and close the latch.",
    ],
    qa: [
      ["Is it the same small OLED as other Bitaxes?", "No. The Hex drives a colour LCD over an 8-bit parallel bus, with U15 driving the backlight."],
    ],
    fix: [
      ["The screen stays dark", "Reseat the ribbon in J2 with the latch fully closed. If the backlight comes on but there is no image, the ribbon isn't making contact."],
    ] },
  { t: "Check the power supply", refs: ["J5"], side: "bottom", flows: ["rails"],
    do: [
      "Use a 12 V DC supply. The board draws around 140 W at the 690 MHz default, and the firmware budgets up to 180 W, so pick a supply with headroom above that.",
      "Power goes in through J5, a 6-pin Mini-Fit Jr (2 × 3) connector: three pins carry 12 V and three are ground.",
    ],
    qa: [
      ["Can I use a PC power supply's PCIe cable?", "J5 is the same connector family as a PCIe power plug. We couldn't verify that a PCIe cable's pinout matches this board's 12 V and ground pins, so check both against the board before you plug in."],
      ["Can I power it from USB-C?", "No. USB-C (J1) is data only, for flashing and logs."],
    ],
    fix: [] },
  { t: "Connect power", refs: ["J5", "U5"], side: "bottom", flows: ["core"],
    do: [
      "Check that at least the J3 fan is connected.",
      "Plug in the 12 V supply. The LCD should light up within a few seconds.",
    ],
    qa: [
      ["What do the buttons do?", "SW1 is RESET and SW2 is BOOT. Hold BOOT while resetting to enter the bootloader for reflashing."],
    ],
    fix: [
      ["It shuts off under load", "The supply can't hold 12 V at full current. Use one that comfortably covers about 140 W."],
    ] },
  wifiStep(["U14", "J2"], "bottom", "LCD"),
  poolStep(["U14"], "bottom", "About 8.45 TH/s at the 690 MHz default (690 MHz × 2040 small cores × 6 chips)."),
];

const NQPP_ASICS = ["U19", "U25", "U20", "U26"];
const NQPP = [
  { t: "Inspect the finished board", refs: [], side: "iso", flows: [],
    do: [
      "Look at both sides under good light.",
      "Top: the four BM1370s in a 2 × 2 block, the three-phase power stage, and the T-Display-S3 controller (U30) on two 12-pin headers. Bottom: the decoupling capacitors under each chip.",
      "Check that the T-Display-S3 is pushed fully onto both headers and isn't offset by a pin.",
    ],
    qa: [
      ["What is the plug-in module?", "A LilyGO T-Display-S3: an ESP32-S3 with a 1.9\" colour screen. It runs the NerdQAxe+ fork of ESP-Miner."],
      ["Which hardware revision is this?", "The model shows rev 5.1.2. The shufps/qaxe README lists rev 5.1 as the version most NerdQAxe++ boards were built from."],
    ],
    fix: [] },
  { t: "Apply thermal paste to all four ASICs", refs: NQPP_ASICS, side: "top", flows: [],
    do: [
      "Clean the top of every chip and the heatsink base with isopropyl alcohol.",
      "Put a small amount of paste on each of U19, U25, U20 and U26.",
    ],
    qa: [
      ["How much paste per chip?", "A thin layer that covers each chip once the heatsink presses down. A small dot on each is enough."],
    ],
    fix: [
      ["One part of the board runs much hotter", "A chip isn't touching the heatsink well. Check the paste and that the heatsink sits flat across all four."],
    ] },
  { t: "Mount the heatsink", place: ["HS1"], refs: NQPP_ASICS, side: "iso", cool: true, flows: [],
    do: [
      "Place the heatsink over the four-chip block.",
      "Screw it down through the M3 holes on the 75 mm square around the chips, tightening in a cross pattern.",
    ],
    qa: [
      ["Which heatsink fits?", "One that matches the M3 holes on a 75 mm square. The heatsink and fan in this view are stand-ins sized to that pattern, not a specific product."],
    ],
    fix: [] },
  { t: "Plug in the fans", place: ["HS1:fan"], refs: ["M1", "M2"], side: "top", flows: ["thermal"],
    do: [
      "Use 12 V, 4-pin PWM fans.",
      "Plug them into M1 and M2.",
    ],
    qa: [
      ["Which way does the fan cable go?", "M1 and M2 are keyed 4-pin Molex 47053-1000 headers, so the plug fits only one way."],
      ["Why two fan headers?", "U32, an EMC2302, drives both headers and counts the RPM of each, so AxeOS can report both fans."],
    ],
    fix: [
      ["A fan reads 0 RPM", "Reseat its plug, and use a 4-pin fan with a tach wire."],
    ] },
  { t: "Check the power supply", refs: ["J1", "F1", "D1"], side: "top", flows: ["core"],
    do: [
      "Use a 12 V DC supply. The project quotes about 76 W at the default settings, and the jack is marked +12V/7A.",
      "The plug is a 5.5 mm barrel into J1.",
    ],
    qa: [
      ["What protects the board?", "An 8 A fuse (F1) sits after the jack, and a SMBJ12A TVS diode (D1) clamps voltage spikes."],
      ["Can I use a 5 V supply?", "No. The NerdQAxe++ runs from 12 V."],
    ],
    fix: [
      ["Nothing powers up at all", "Check the supply voltage, then check fuse F1. The fuse can blow on a short or a wrong-voltage supply."],
    ] },
  { t: "Connect power", refs: ["J1", "U3"], side: "top", flows: ["core"],
    do: [
      "Check that the fans are connected.",
      "Plug in the 12 V supply. The T-Display-S3 screen should light up.",
    ],
    qa: [
      ["Why does the core voltage come up last?", "The firmware turns on the 1.2 V and 0.8 V I/O rails first, then enables the core regulator, then releases the chips from reset."],
    ],
    fix: [
      ["The screen is on but it doesn't hash", "The core regulator (U3) only starts when the ESP32 raises PWR_EN. Check the logs over USB for regulator or ASIC errors."],
    ] },
  { t: "First boot and Wi-Fi setup", refs: ["U30"], side: "top", flows: [],
    do: [
      "If the module needs firmware, flash it with the web flasher linked from the ESP-Miner-NerdQAxePlus README. Press BOOT before flashing to enter the bootloader.",
      "On first boot the firmware starts a setup hotspot. Join it from a phone or laptop and enter your 2.4 GHz Wi-Fi details.",
      "Once it joins your network, open AxeOS at the IP shown on the screen.",
    ],
    qa: [
      ["Does it work on 5 GHz Wi-Fi?", "No. The ESP32-S3 radio is 2.4 GHz only."],
    ],
    fix: [
      ["It never joins my network", "Check the password and that the network is 2.4 GHz. Some routers block mining traffic."],
    ] },
  poolStep(["U30"], "top", "About 4.8 TH/s at the 600 MHz default, the project's figure."),
];
NQPP[NQPP.length - 1].fix.push(
  ["The hashrate is low or it runs hot", "The firmware runs the fans on a PID loop toward a 55 °C target. If the fans are at full speed and it is still hot, check the paste and heatsink contact."],
);

export const ASSEMBLY = { gamma: GAMMA, hex: HEX, nerdqaxepp: NQPP };

/* Placement steps, built from the board's own part list: every populated part
   starts in the tray beside the bare PCB and moves onto it in its step. */
const PLACE_ORDER = [
  ["power", "Place the power stage"],
  ["asic", "Place the ASIC and its clock"],
  ["control", "Place the controller"],
  ["thermal", "Place the thermal parts"],
  ["io", "Place the connectors and buttons"],
];
const PLACE_QA = [
  ["Is this the real soldering order?", "It groups the parts by subsystem so you can see where each one goes. A real build reflows one side of the board, then the other."],
];
const sideName = s => s === "bottom" ? "bottom side" : "top side";

function placementSteps(B) {
  const parts = B.PARTS.filter(p => !p.dnp && p.bom !== false);
  const passives = B.PASSIVES.filter(p => p[1] !== "DNP").map(p => p[0]);
  const steps = [
    { t: "Lay out the parts", refs: [], side: "iso", flows: [],
      do: [
        `Every populated part of the ${B.title} is laid out in the tray beside the bare PCB: ${parts.length} main parts and ${passives.length} passives.`,
        "Each of the next steps moves one group of parts onto its footprint. Click any part, in the tray or on the board, to see what it is.",
      ],
      qa: PLACE_QA, fix: [] },
    { t: "Place the passives", place: passives, refs: passives, side: "iso", flows: [],
      do: [
        `${passives.length} resistors and capacitors go down first, on both sides of the board.`,
        "Most of them are decoupling capacitors that sit as close as possible to the pins they feed.",
      ],
      qa: [], fix: [] },
  ];
  PLACE_ORDER.forEach(([g, t]) => {
    const ps = parts.filter(p => p.group === g);
    const extra = g === "io" && B.oled ? ["DSP1"] : [];
    if (!ps.length && !extra.length) return;
    const refs = [...ps.map(p => p.ref), ...extra];
    steps.push({ t, place: refs, refs, side: ps.every(p => p.side === "bottom") ? "bottom" : "top", flows: [],
      do: [
        ...ps.map(p => `${p.ref} · ${p.name}${p.part ? ` (${p.part})` : ""}, ${sideName(p.side)}`),
        ...(extra.length ? ['DSP1 · 0.91" OLED module, plugs into ' + B.oled.header] : []),
      ],
      qa: g === "asic" ? PLACE_QA : [], fix: [] });
  });
  return steps.map(st => ({ ...st, group: "Build the board" }));
}

const cache = {};
export function stepsFor(boardId) {
  if (!ASSEMBLY[boardId] || !BOARDS[boardId]) return null;
  return cache[boardId] ||= [...placementSteps(BOARDS[boardId]), ...ASSEMBLY[boardId]];
}

// Refs on the board once steps 0..idx are done.
export const placedAt = (steps, idx) => new Set(steps.slice(0, idx + 1).flatMap(s => s.place || []));

// Questions about one part: every step that involves it.
export const partQA = (boardId, ref) =>
  (stepsFor(boardId) || []).filter(s => s.refs.includes(ref) && (s.qa.length || s.fix.length || !s.place));
