/* Bitaxe Gamma data: component positions, nets and descriptions (from bitaxeGamma KiCad files + ESP-Miner). */
"use strict";
/* ====================================================================
   DATA — positions, packages and nets come from bitaxeGamma.kicad_pcb
   (github.com/bitaxeorg/bitaxeGamma). "top" = the side with the ESP32,
   ASIC and heatsink (KiCad B.Cu). "bottom" = power-stage side (F.Cu).
   ==================================================================== */
const EDGE = {x0:76.454, x1:133.732, y0:50.062, y1:147.284};
const BW = EDGE.x1-EDGE.x0, BH = EDGE.y1-EDGE.y0, BT = 1.6;

const GROUPS = {
  asic:    {name:"Hashing",              color:"--c-asic"},
  power:   {name:"Power conversion",     color:"--c-power"},
  control: {name:"Control & comms",      color:"--c-control"},
  thermal: {name:"Thermal",              color:"--c-thermal"},
  io:      {name:"Connectors & UI",      color:"--c-io"},
  passive: {name:"Passives",             color:"--c-passive"},
  test:    {name:"Test points",          color:"--c-test"},
  mech:    {name:"Board & mechanics",    color:"--c-mech"},
};
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const ESPM = "https://github.com/bitaxeorg/ESP-Miner";
const REPO = "https://github.com/bitaxeorg/bitaxeGamma";

/* Main components. dims = [x-size, y-size, height] in KiCad orientation (before rotation). */
const PARTS = [
 { ref:"U8", name:"BM1370 mining ASIC", part:"Bitmain BM1370", pkg:"32-pad QFN-style, 2 exposed pads", group:"asic", side:"top", x:105.611, y:116.546, rot:180, dims:[8.6,7.8,1.0], mat:"asic", mark:"BM1370",
   what:"The chip that does the actual Bitcoin mining. It runs SHA-256 double hashing over block headers billions of times per second, searching for a nonce that produces a hash below the target.",
   how:"It comes from Bitmain's Antminer S21 Pro (3 hashboards × 65 chips = 195 chips, 234 TH/s nominal). The Gamma runs one of those chips by itself. ESP-Miner treats it as 128 cores split into 2040 small cores across 4 hash domains, and each small core tests roughly one nonce per clock. Hashrate is therefore about frequency × 2040: 525 MHz gives ≈1.07 TH/s. Version rolling (ASICBoost) is done in hardware.",
   specs:[["Origin","Antminer S21 Pro (Bitmain)"],["Chip ID","0x1370"],["Cores","128 cores / 2040 small cores"],["Hash domains","4"],["Default clock","525 MHz (options 400–690)"],["Default core V","1150 mV (options 1000–1250)"],["Bitmain efficiency claim","15 J/TH"],["UART","115200 baud at boot → 1 Mbaud"],["ASIC difficulty","256"],["Throttle","> 75 °C → overheat mode"]],
   nets:["VDD (pad 31)","VSS (pad 32)","CI","RO","NRSTI","CLKI","TEMP_P/N","VDDIO_12","VDDIO_08","VDD1–3 taps"],
   note:"Not open source and not sold individually when the Gamma launched; boards are built with chips pulled from S21 Pro hashboards. Its footprint and pinout differ from the BM1368/1366/1397 used in earlier Bitaxes.",
   links:[["BM1370 driver (ESP-Miner)",ESPM+"/blob/master/components/asic/bm1370.c"]] },

 { ref:"U2", name:"Core voltage regulator", part:"TI TPS546D24ARVFR", pkg:"40-pin LQFN-CLIP", group:"power", side:"bottom", x:93.58, y:77.59, rot:90, dims:[7,5,1.5], mat:"ic", mark:"TPS546D24A",
   what:"A digitally controlled synchronous buck converter that turns the 5 V input into the ASIC's ~1.15 V core rail (VDD), which can draw well over 15 A.",
   how:"It switches 5 V through the inductor L1 at 650 kHz. The ESP32 talks to it over PMBus (I2C address 0x24) to set the output voltage and to read back input voltage, output current and its own temperature. Those readings become the power figure in AxeOS. Its remote-sense pins (VOSNS/GOSNS through R14/R13) measure the voltage at the load, so the ASIC gets an accurate rail.",
   specs:[["Input","4.5–5.5 V (board 5 V rail)"],["Output","VDD ≈ 1.0–1.25 V, 1.15 V default"],["Switching","650 kHz (firmware default)"],["I2C / PMBus","0x24"],["VIN on / off","4.8 V / 4.5 V"],["VIN OV fault","6.5 V"],["IOUT warn / fault","25 A / 30 A"],["Thermal throttle","> 105 °C"],["Status lines","PGOOD → GPIO11, SMB_ALRT → GPIO13"]],
   nets:["5V","SW","VDD (via L1)","SDA/SCL","PGOOD","SMB_ALRT","AGND (net-tie T1)"],
   links:[["TPS546 driver",ESPM+"/blob/master/main/power/TPS546.c"]] },

 { ref:"L1", name:"Buck output inductor", part:"Coilcraft SLC1175-301MEC (300 nH)", pkg:"SLC1175 flat-wire SMD", group:"power", side:"bottom", x:100.27, y:85.255, rot:0, dims:[11,7.6,5.2], mat:"inductor", mark:"R30",
   what:"Stores energy every switching cycle and smooths the chopped 5 V square wave from U2 into steady DC current for the ASIC.",
   how:"U2's switch node (SW) drives one end; the other end is the VDD rail. A low inductance (300 nH) with a flat-wire winding keeps resistance low, which matters at 15–20 A.",
   specs:[["Inductance","300 nH"],["Between","SW node → VDD"],["BOM note","Footprint named SLC1175-271; BOM part is -301"]],
   nets:["SW","VDD"] },

 { ref:"U3", name:"3.3 V regulator", part:"Richtek RT9080-33GJ5", pkg:"TSOT-23-5", group:"power", side:"bottom", x:112.563, y:63.38, rot:0, dims:[2.9,1.6,1], mat:"ic",
   what:"Low-dropout linear regulator making the 3.3 V logic rail from 5 V.",
   how:"Feeds the ESP32-S3 module, the EMC2101 fan controller, the OLED, the 3.3 V side of the level shifter, and the I2C/PGOOD pull-ups.",
   specs:[["In → out","5 V → 3.3 V"],["Rated current","600 mA"],["Type","LDO, low quiescent current"]],
   nets:["5V","3V3","GND"] },

 { ref:"U5", name:"1.2 V I/O regulator", part:"Microchip MCP1824T-1202E/OT", pkg:"SOT-23-5", group:"power", side:"bottom", x:110.981, y:130.229, rot:0, dims:[2.9,1.6,1.1], mat:"ic",
   what:"LDO making the 1.2 V rail for the ASIC's I/O ring.",
   how:"Supplies BM1370 VDDIO_12, the 25 MHz oscillator U7, and the 1.2 V side of the level shifter U9. Its power-good pin is unused.",
   specs:[["In → out","5 V → 1.2 V"],["Rated current","300 mA"]],
   nets:["5V","1V2"] },

 { ref:"U6", name:"0.8 V I/O regulator", part:"Microchip MCP1824T-0802E/OT", pkg:"SOT-23-5", group:"power", side:"bottom", x:102.53, y:130.47, rot:0, dims:[2.9,1.6,1.1], mat:"ic",
   what:"LDO making the 0.8 V rail for the ASIC's second I/O supply.",
   how:"Feeds BM1370 VDDIO_08 (pin 14). Two separate small rails (1.2 V and 0.8 V) keep the chip's I/O supplies clean and independent of the noisy, high-current core rail.",
   specs:[["In → out","5 V → 0.8 V"],["Rated current","300 mA"]],
   nets:["5V","0V8"] },

 { ref:"U4", name:"ESP32-S3 controller", part:"Espressif ESP32-S3-WROOM-1-N16R8", pkg:"Module 18 × 25.5 mm, PCB antenna", group:"control", side:"top", x:117.43, y:72.61, rot:90, dims:[18,25.5,3.1], mat:"esp", mark:"ESP32-S3-WROOM-1",
   what:"The brain of the miner. It runs the open-source ESP-Miner firmware and the AxeOS web dashboard, connects to Wi-Fi, speaks Stratum to your pool, and feeds work to the ASIC.",
   how:"It gets jobs from the pool, builds block-header work and sends it to the BM1370 over UART. When nonces come back it checks them against the pool difficulty and submits shares. It also runs the control loops: core voltage and frequency through U2, fan and temperature through U10, the OLED, the buttons, and overheat protection.",
   specs:[["CPU","Dual-core Xtensa LX7, up to 240 MHz"],["Memory","16 MB flash, 8 MB PSRAM (N16R8)"],["Radio","2.4 GHz Wi-Fi 802.11 b/g/n, Bluetooth LE"],["ASIC UART","GPIO17 TX → CI, GPIO18 RX ← RO"],["ASIC reset","GPIO1"],["I2C","GPIO47 SDA, GPIO48 SCL"],["VDD sense","GPIO2 (ADC1 ch1)"],["Native USB","GPIO19 D−, GPIO20 D+"],["Accessory","GPIO39–42"]],
   nets:["3V3","TX/RX","RST","SDA/SCL","PGOOD","SMB_ALRT","USB D+/D−","EN","IO0"],
   links:[["ESP-Miner firmware",ESPM],["Web flasher","https://bitaxeorg.github.io/bitaxe-web-flasher/"]] },

 { ref:"U9", name:"Logic level shifter", part:"TI SN74AVC4T774PWR", pkg:"TSSOP-16", group:"control", side:"bottom", x:118.29, y:100.13, rot:0, dims:[5,4.4,1.1], mat:"ic", mark:"AVC4T774",
   what:"Translates signals between the ESP32's 3.3 V logic and the ASIC's 1.2 V I/O. Without it the ESP32 would overdrive the ASIC pins and could not reliably read the ASIC's replies.",
   how:"It is a 4-bit dual-supply transceiver with per-channel direction control. Three channels are used: ESP TX → ASIC CI (commands and jobs), ASIC RO → ESP RX (responses and nonces), and ESP GPIO1 → ASIC NRSTI (reset). The fourth channel is unused. OE is held low by R21 (20 kΩ), so it is always enabled.",
   specs:[["A side","3.3 V (ESP32)"],["B side","1.2 V (ASIC)"],["Channels used","3 of 4"],["OE","R21 20 kΩ to GND"]],
   nets:["TX→CI","RO→RX","RST→RST_N","3V3","1V2"] },

 { ref:"U7", name:"25 MHz oscillator", part:"SX3M25.000E20F30THN", pkg:"3.2 × 2.5 mm SMD", group:"asic", side:"bottom", x:114.73, y:125.22, rot:90, dims:[3.2,2.5,0.9], mat:"metal",
   what:"The reference clock for the ASIC.",
   how:"Runs from the 1.2 V rail and drives BM1370 CLKI. Inside the ASIC a PLL multiplies the 25 MHz reference up to the hashing clock (for example 21 × 25 MHz = 525 MHz). The firmware sets the PLL dividers when you change frequency in AxeOS.",
   specs:[["Frequency","25 MHz"],["Supply","1.2 V"],["Drives","CLKI (ASIC pin 8)"]],
   nets:["1V2","CLKI"] },

 { ref:"U10", name:"Fan controller + temp sensor", part:"Microchip EMC2101-R-ACZL", pkg:"MSOP-8", group:"thermal", side:"bottom", x:93.895, y:129.99, rot:-90, dims:[3,3,1], mat:"ic",
   what:"Reads the ASIC's on-die temperature diode and drives the cooling fan.",
   how:"Its remote-diode inputs connect to BM1370 TEMP_P/TEMP_N through 100 Ω resistors (R22, R23) with a 470 pF filter capacitor (C50). It outputs PWM to the fan and counts tachometer pulses to report RPM. The ESP32 reads it over I2C. Firmware applies a diode ideality setting of 0x24 for this chip.",
   specs:[["I2C","0x4C"],["Temp input","ASIC TEMP_P/N (pins 20/21)"],["Fan","PWM out, TACH in"],["Supply","3.3 V"]],
   nets:["TEMP_DP/DN","FAN_PWM","FAN_TACH","SDA/SCL","3V3"] },

 { ref:"J1", name:"5 V DC barrel jack", part:"Tensility 54-00164", pkg:"5.5 × 2.1 mm, centre positive", group:"io", side:"top", x:84.58, y:66.62, rot:90, dims:[9,14,11], mat:"jack",
   what:"Main power input. Everything on the board runs from this 5 V.",
   how:"5 V DC only; a higher voltage will damage the board. The supply must deliver more than 4 A (20 W) without sagging below 5 V. The project suggests a 25–30 W supply such as the Mean Well GST60A05-P1J. Bulk capacitors C3/C4 (47 µF) sit right at U2's input.",
   specs:[["Voltage","5 V DC only"],["Current","> 4 A recommended"],["Plug","5.5 × 2.1 mm (5.5 × 2.5 often fits)"],["Polarity","Centre positive"]],
   nets:["5V","GND"] },

 { ref:"J5", name:"USB-C port (data)", part:"GCT USB4105-GF-A", pkg:"USB-C receptacle, USB 2.0", group:"io", side:"top", x:80.865, y:83.26, rot:90, dims:[7.3,8.94,3.2], mat:"metal",
   what:"For flashing firmware and reading logs. It does not power the board.",
   how:"Only D+ and D− are wired, to the ESP32-S3's built-in USB Serial/JTAG on GPIO19/20. VBUS and the CC pins are not connected. Because there are no CC resistors, a USB-C-to-C cable from some hosts may not be detected; a USB-A-to-C cable avoids that.",
   specs:[["Data","USB 2.0 full speed → ESP32 native USB"],["VBUS","Not connected"],["CC1/CC2","Not connected"]],
   nets:["USB_D+","USB_D−","GND"] },

 { ref:"J3", name:"OLED display header", part:"4-pin 2.54 mm header", pkg:"1 × 4", group:"io", side:"top", x:87.205, y:50.292, rot:180, dims:[10.16,2.54,8.5], mat:"header",
   what:"Plugs in a 0.91\" SSD1306 128 × 32 I2C OLED that shows hashrate, efficiency, IP address and status.",
   how:"Pinout GND, VCC (3.3 V), SCL, SDA, silkscreened next to the header. It shares the I2C bus with U2 and U10. The display sits at address 0x3C.",
   specs:[["Display","SSD1306 128×32, 0.91\""],["I2C","0x3C"],["Pins","GND · VCC · SCL · SDA"]],
   nets:["GND","3V3","SCL","SDA"] },

 { ref:"J4", name:"Accessory port", part:"6-pin 2.54 mm header", pkg:"1 × 6", group:"io", side:"bottom", x:99.1715, y:51.054, rot:90, dims:[2.54,15.24,2.5], mat:"header",
   what:"An expansion header for add-ons.",
   how:"Carries 5 V, GND and ESP32 GPIO39–42, which are also the ESP32's JTAG pins. Current ESP-Miner uses GPIO39/40 as a UART for BAP, the Bitaxe Accessory Protocol, so external displays or controllers can read stats and change settings.",
   specs:[["Pin 1–2","5 V, GND"],["Pin 3–6","GPIO39, 40, 41, 42"],["Protocol","BAP UART (TX 39 / RX 40)"]],
   nets:["5V","GND","GPIO39–42"],
   links:[["BAP readme",ESPM+"/blob/master/main/bap/bap_readme.md"]] },

 { ref:"J2", name:"Tag-Connect programming pads", part:"TC2030-IDC-NL footprint", pkg:"2 × 3 pads, 1.27 mm", group:"io", side:"top", x:128.13, y:57.73, rot:180, dims:[4,2.6,0.05], mat:"pads",
   what:"A connector-less programming footprint. A spring-pin Tag-Connect cable presses onto these pads.",
   how:"Exposes EN, 3.3 V, UART0 TX/RX, GND and IO0, so an ESP-PROG can flash or recover the ESP32 even when USB is not usable.",
   specs:[["Signals","EN · 3V3 · U0TXD · GND · U0RXD · IO0"]],
   nets:["EN","3V3","P_TX","P_RX","IO0"] },

 { ref:"SW1", name:"RESET button", part:"CS1213AGF260", pkg:"SMD tact switch", group:"io", side:"top", x:130.186, y:104.448, rot:180, dims:[3.6,3,1.6], mat:"button",
   what:"Restarts the ESP32.",
   how:"Pulls the ESP32's EN pin to ground. EN normally rises through R16 (10 kΩ) and C22 (1 µF), which also gives a clean power-on reset delay.",
   specs:[["Signal","EN"]], nets:["EN","GND"] },

 { ref:"SW2", name:"BOOT button", part:"CS1213AGF260", pkg:"SMD tact switch", group:"io", side:"top", x:130.082, y:113.155, rot:180, dims:[3.6,3,1.6], mat:"button",
   what:"Holds GPIO0 low. Hold it while pressing RESET to enter the ESP32 ROM bootloader for recovery flashing.",
   how:"While running, ESP-Miner also reads this button as user input, for example to cycle display screens or, held at boot, to restore settings.",
   specs:[["Signal","GPIO0 (strapping pin)"]], nets:["IO0","GND"] },

 { ref:"J6", name:"Fan connector (4-pin)", part:"Molex 0470531000", pkg:"4-pin 2.54 mm", group:"thermal", side:"top", x:89.621, y:143.622, rot:0, dims:[10.2,5.8,6], mat:"fanconn",
   what:"Standard 4-pin PWM fan header. Active cooling is required; the heatsink alone is not enough.",
   how:"Pins: GND, 5 V, TACH, PWM. Use a 5 V PWM fan. A 12 V fan will spin too slowly and the board will overheat. The project suggests the Noctua NF-A4x10 5V PWM for quieter running. R25 pulls PWM high so the fan runs at full speed if the controller is not driving it.",
   specs:[["Pins","GND · 5V · TACH · PWM"],["Fan","40 mm, 5 V, 4-pin PWM"]],
   nets:["GND","5V","FAN_TACH","FAN_PWM"] },

 { ref:"J7", name:"Alt. fan connector (JST-SH)", part:"JST BM04B-SRSS-TB", pkg:"4-pin 1.0 mm SH", group:"thermal", side:"top", x:103.5, y:143, rot:0, dims:[6,4.25,2.9], mat:"fanconn",
   what:"An alternative small-pitch footprint for fans with JST-SH plugs.",
   how:"Wired in parallel with J6 (GND, 5 V, TACH, PWM). The BOM gives it no part number, so many boards leave it unpopulated.",
   specs:[["Pins","GND · 5V · TACH · PWM"],["Pitch","1.0 mm"]], nets:["GND","5V","FAN_TACH","FAN_PWM"] },

 { ref:"T1", name:"Analog-ground net tie", part:"Net-tie 0.25 mm", pkg:"copper bridge", group:"power", side:"bottom", x:90.825, y:77.85, rot:0, dims:[1,0.5,0.05], mat:"pads",
   what:"Joins the regulator's quiet analog ground (AGND) to the main ground at one chosen point.",
   how:"Keeping the small-signal ground of U2 separate, then tying it to power ground at a single spot, stops the large switching currents from disturbing U2's voltage measurements.",
   specs:[["Joins","AGND ↔ GND"]], nets:["AGND","GND"] },
];

/* Passives: [ref, value, size, x, y, rot, nets, group, role] — all on the bottom side (F.Cu). */
const PASSIVES = [
 ["C3","47 µF","1210",96.6,63.3,0,"5V/GND","power","Bulk input capacitor at U2. It supplies the large pulse currents the buck converter draws each cycle."],
 ["C4","47 µF","1210",96.6,66.55,0,"5V/GND","power","Bulk input capacitor at U2, paired with C3."],
 ["C2","10 µF","0805",96.6,69.35,0,"5V/GND","power","Input decoupling for U2."],
 ["C7","1 µF","0402",96.59,71.54,0,"5V/GND","power","High-frequency input decoupling for U2."],
 ["C6","4700 pF","0402",96.57,74,0,"5V/GND","power","Very-high-frequency input decoupling at U2's power pins."],
 ["C9","2200 pF","0402",96.57,72.76,0,"5V/GND","power","Very-high-frequency input decoupling at U2's power pins."],
 ["C10","4.7 µF","0402",102.75,75.04,-90,"VDD5/GND","power","Bypass for U2's internal 5 V gate-drive regulator (VDD5 pin)."],
 ["C1","1 µF","0402",92.17,82.22,180,"BP1V5/DRTN","power","Bypass for U2's internal 1.5 V reference regulator (BP1V5)."],
 ["C5","1 µF","0402",86.79,70.11,0,"AVIN/AGND","power","With R11, an RC filter that cleans U2's analog supply (AVIN)."],
 ["R11","10 Ω","0402",93.88,72.93,180,"5V/AVIN","power","With C5, an RC filter that cleans U2's analog supply (AVIN)."],
 ["C12","0.1 µF","0402",93.1,83.76,-90,"BOOT/SW","power","Bootstrap capacitor. It lets U2 drive its high-side MOSFET gate above the input voltage."],
 ["R12","1 Ω","1206",91.55,88.21,180,"SW/C11","power","Switch-node RC snubber resistor. With C11 it damps ringing on SW, which reduces EMI and voltage spikes."],
 ["C11","1000 pF","0805",92.14,85.86,0,"SW/R12","power","Switch-node RC snubber capacitor."],
 ["R14","49.9 Ω","0402",86.09,76.57,0,"VDD/VOSNS","power","Remote-sense resistor carrying the VDD measurement back to U2 (positive)."],
 ["R13","49.9 Ω","0402",86.09,77.64,180,"GOSNS/GND","power","Remote-sense resistor for the ground side of the VDD measurement."],
 ["C13","100 pF","0402",87.63,77.49,-90,"VOSNS/GOSNS","power","Filters noise on the differential voltage-sense lines."],
 ["R9","11.8 kΩ","0402",93.89,73.99,180,"5V/EN","power","Top half of U2's EN/UVLO divider. Sets the input voltage at which the regulator is allowed to start."],
 ["R8","3.74 kΩ","0402",89.56,70.1,180,"EN/AGND","power","Bottom half of U2's EN/UVLO divider."],
 ["C8","0.1 µF","0402",89.56,71.13,180,"EN/AGND","power","Filters the EN/UVLO divider."],
 ["R1","8.25 kΩ","0402",86.1,75.5,0,"BP1V5/MSEL1","power","Pin-strap divider for U2 MSEL1 (selects default switching and loop settings at power-up)."],
 ["R5","14.7 kΩ","0402",88,75.72,0,"MSEL1/AGND","power","Pin-strap divider for U2 MSEL1."],
 ["R6","0 Ω","0402",88,72.1,180,"MSEL2/AGND","power","Strap for U2 MSEL2."],
 ["R10","68.1 kΩ","0402",88.01,73.17,180,"VSEL/AGND","power","Strap for U2 VSEL, the default output voltage before firmware takes over."],
 ["R2","DNP","0402",85.62,72.1,0,"BP1V5/MSEL2","power","Unpopulated strap option for MSEL2."],
 ["R3","DNP","0402",86.1,74.33,0,"BP1V5/ADRSEL","power","Unpopulated strap option for the PMBus address."],
 ["R4","DNP","0402",86.1,73.36,0,"BP1V5/VSEL","power","Unpopulated strap option for VSEL."],
 ["R7","DNP","0402",88.01,74.32,180,"ADRSEL/AGND","power","Unpopulated strap option for the PMBus address."],
 ["R15","10 kΩ","0402",110.99,74.51,0,"PGOOD/3V3","control","Pull-up for U2's open-drain power-good output, read by ESP32 GPIO11."],
 ["C14","22 µF","0805",104.58,78.93,90,"VDD/GND","power","Output capacitor on the ASIC core rail."],
 ["C15","22 µF","0805",100.36,78.91,90,"VDD/GND","power","Output capacitor on the ASIC core rail."],
 ["C16","22 µF","0805",102.48,78.91,90,"VDD/GND","power","Output capacitor on the ASIC core rail."],
 ["C17","100 µF","1206",108.89,90.91,0,"VDD/GND","power","Bulk output capacitor on VDD. Smooths ripple and holds up the rail during load steps."],
 ["C18","100 µF","1206",108.91,87.66,0,"VDD/GND","power","Bulk output capacitor on VDD."],
 ["C19","100 µF","1206",108.91,84.4,0,"VDD/GND","power","Bulk output capacitor on VDD."],
 ["C20","100 µF","1206",108.91,81.12,0,"VDD/GND","power","Bulk output capacitor on VDD."],
 ["C43","100 µF","1206",105.67,104.85,-90,"VDD/GND","asic","Bulk VDD capacitor right under the ASIC's power entry."],
 ["C37","0.1 µF","0402",109.19,104.84,-90,"VDD/GND","asic","High-frequency VDD decoupling near the ASIC."],
 ["C38","0.1 µF","0402",103.24,104.84,-90,"VDD/GND","asic","High-frequency VDD decoupling near the ASIC."],
 ["C39","1 µF","0402",102.11,104.84,-90,"VDD/GND","asic","VDD decoupling near the ASIC."],
 ["C40","1 µF","0402",108.07,104.84,-90,"VDD/GND","asic","VDD decoupling near the ASIC."],
 ["C36","1 µF","0402",110.215,103.146,180,"VDD/VDD1_0","asic","Domain ladder, left side: bridges VDD to the first internal tap."],
 ["C34","1 µF","0402",111.53,106.266,180,"VDD1_0/VDD2_0","asic","Domain ladder, left side: bridges two adjacent internal hash-domain taps."],
 ["C32","1 µF","0402",112.83,108.026,180,"VDD2_0/VDD3_0","asic","Domain ladder, left side: bridges two adjacent internal hash-domain taps."],
 ["C28","1 µF","0402",113.93,109.86,180,"VDD3_0/GND","asic","Domain ladder, left side: last tap to ground."],
 ["C41","1 µF","0402",101.09,103.154,180,"VDD/VDD1_1","asic","Domain ladder, right side: bridges VDD to the first internal tap."],
 ["C44","1 µF","0402",99.961,106.284,180,"VDD1_1/VDD2_1","asic","Domain ladder, right side: bridges two adjacent internal taps."],
 ["C46","1 µF","0402",98.681,108.024,180,"VDD2_1/VDD3_1","asic","Domain ladder, right side: bridges two adjacent internal taps."],
 ["C48","1 µF","0402",97.61,109.925,180,"VDD3_1/GND","asic","Domain ladder, right side: last tap to ground."],
 ["C29","0.1 µF","0402",114.79,128.01,180,"1V2/GND","asic","Decoupling for the 1.2 V rail near U7 and U5."],
 ["C30","1 µF","0402",114.24,130.02,-90,"1V2/GND","power","Output capacitor for U5 (1.2 V)."],
 ["C35","1 µF","0402",112.14,122.31,90,"1V2/GND","asic","1.2 V decoupling at the ASIC I/O pins."],
 ["C47","0.1 µF","0402",123.79,103.11,180,"1V2/GND","control","1.2 V decoupling at U9 (B side)."],
 ["C31","1 µF","0402",105.75,130.47,-90,"0V8/GND","power","Output capacitor for U6 (0.8 V)."],
 ["C33","1 µF","0402",111,122.31,90,"0V8/GND","asic","0.8 V decoupling at the ASIC I/O pins."],
 ["C42","1 µF","0402",100.655,122.33,90,"VDDIO_12_1/GND","asic","Bypass on ASIC pin 16 (VDDIO_12_1), which has no external feed."],
 ["C45","1 µF","0402",99.525,122.34,90,"VDDIO_08_1/GND","asic","Bypass on ASIC pin 17 (VDDIO_08_1), which has no external feed."],
 ["C26","1 µF","0402",110.961,132.739,0,"5V/GND","power","Input capacitor for U5."],
 ["C27","1 µF","0402",102.42,132.84,0,"5V/GND","power","Input capacitor for U6."],
 ["R17","10 kΩ","0402",120.38,113.26,-90,"BI/GND","asic","Ties ASIC chain input BI low. Unused with a single chip."],
 ["R18","1 kΩ","0402",123.21,116.22,180,"ROSC_SEL/GND","asic","Strap for ASIC ROSC_SEL (pin 10)."],
 ["R19","1 kΩ","0402",123.21,118.98,180,"LITE_PAD/GND","asic","Strap for ASIC LITE_PAD (pin 11)."],
 ["R21","20 kΩ","0402",121.5,103.71,180,"OE/GND","control","Holds U9's output-enable low so the level shifter is always on."],
 ["C49","0.1 µF","0402",122.93,101.12,-90,"3V3/GND","control","3.3 V decoupling at U9 (A side)."],
 ["C21","1 µF","0402",111.62,60.03,0,"5V/GND","power","Input capacitor for U3."],
 ["C23","1 µF","0402",113.72,60.03,180,"3V3/GND","power","Output capacitor for U3 (3.3 V)."],
 ["C24","10 µF","0805",126.39,86.18,0,"3V3/GND","control","Bulk 3.3 V capacitor at the ESP32. Covers Wi-Fi transmit current bursts."],
 ["C25","0.1 µF","0402",126.39,87.79,0,"3V3/GND","control","High-frequency 3.3 V decoupling at the ESP32."],
 ["R16","10 kΩ","0402",127.24,106.26,90,"3V3/EN","control","EN pull-up. With C22 it forms the ESP32's power-on reset delay."],
 ["C22","1 µF","0402",128.67,106.25,-90,"EN/GND","control","EN delay capacitor. Holds the ESP32 in reset until power is stable."],
 ["R22","100 Ω","0402",93.38,124.36,90,"TEMP_N/DN","thermal","Series resistor on the ASIC temperature-diode line (N)."],
 ["R23","100 Ω","0402",94.52,124.36,-90,"TEMP_P/DP","thermal","Series resistor on the ASIC temperature-diode line (P)."],
 ["C50","470 pF","0402",93.96,125.94,180,"DP/DN","thermal","Filter capacitor across the remote-diode inputs. Rejects noise on the temperature reading."],
 ["R24","5.6 kΩ","0402",94.07,135.71,0,"TACH/3V3","thermal","Pull-up for the fan's open-collector tachometer output."],
 ["R25","10 kΩ","0402",98.64,140.75,90,"PWM/5V","thermal","Pulls the fan PWM line high, so the fan runs at full speed by default."],
 ["C51","47 µF","1210",102.045,141.29,-90,"5V/GND","thermal","Bulk 5 V capacitor for the fan supply."],
 ["C52","0.1 µF","0402",97.56,137.64,180,"5V/GND","thermal","5 V decoupling near the fan connectors."],
 ["C53","0.1 µF","0402",97.2,140.73,-90,"5V/GND","thermal","5 V decoupling near the fan connectors."],
];
const PKG = {"0402":[1,0.5,0.45],"0805":[2,1.25,1],"1206":[3.2,1.6,1.1],"1210":[3.2,2.5,2]};

const TPS = [["TP1",82.39,70.94,"5V"],["TP2",82.31,62.1,"GND"],["TP3",101.98,91.23,"VDD"],["TP4",97.22,91.21,"GND"],["TP5",118.46,62.54,"ESP EN"],["TP6",122.43,62.54,"P_TX"],["TP7",122.42,58.83,"P_RX"],["TP8",123.61,84.12,"3V3"],["TP9",122.44,55.09,"IO0"],["TP10",118.48,55.14,"GND"],["TP11",118.48,58.69,"3V3"],["TP13",110.99,96.64,"RST_N"],["TP14",110.99,99.61,"CI"],["TP15",119.55,108.28,"RO"],["TP16",122.86,113.98,"BI"],["TP17",120.9,116.06,"ROSC_SEL"],["TP18",120.82,119.01,"LITE_PAD"],["TP19",114.86,134.28,"1V2"],["TP20",106.36,134.23,"0V8"],["TP21",122.86,121.97,"INV_CLKO"],["TP22",118.52,122.76,"CLKI"],["TP29",87.08,112.616,"NRSTO"],["TP30",89.89,114.52,"CO"],["TP31",87.08,115.554,"RI"],["TP32",89.89,117.31,"CLKO"],["TP33",87.08,118.492,"BO"],["TP34",89.86,120.48,"PIN_MODE"],["TP35",96.28,123.89,"TEMP_P"],["TP36",91.65,123.88,"TEMP_N"],["TP37",93.61,140.38,"FAN_TACH"],["TP38",90.3,140.41,"FAN_PWM"]];

const HOLES = [["H1",130.235,51.121,3,"pad"],["H2",80.808,51.054,3,"pad"],["H3",130.302,143.728,3,"pad"],["H4",80.705,143.831,3,"pad"],["H5",126.06,136.36,3.5,"hs"],["H6",84.71,94.91,3.5,"hs"],["H7",126.06,94.91,3.5,"hs"],["H8",84.71,136.36,3.5,"hs"]];
const HS_CENTER = [105.385,115.635];

/* BM1370 pin map from the KiCad footprint (pads 1–15 one side, 16–30 the other, 31/32 exposed) */
const PINS = [
 [1,"VDD3_0","tap"],[2,"VDD2_0","tap"],[3,"VDD1_0","tap"],[4,"VSS","gnd"],[5,"NRSTI","ctl"],[6,"CI","ctl"],[7,"RO","ctl"],[8,"CLKI","clk"],[9,"BI","ctl"],[10,"ROSC_SEL","strap"],[11,"LITE_PAD","strap"],[12,"INV_CLKO","clk"],[13,"PLL_VSS","gnd"],[14,"VDDIO_08_0","io"],[15,"VDDIO_12_0","io"],
 [16,"VDDIO_12_1","io"],[17,"VDDIO_08_1","io"],[18,"VSS","gnd"],[19,"PIN_MODE","strap"],[20,"TEMP_P","temp"],[21,"TEMP_N","temp"],[22,"BO","chain"],[23,"CLKO","chain"],[24,"RI","chain"],[25,"CO","chain"],[26,"NRSTO","chain"],[27,"VSS","gnd"],[28,"VDD1_1","tap"],[29,"VDD2_1","tap"],[30,"VDD3_1","tap"]];

/* Flows: points as [x, y, side] in KiCad coordinates. side: t (top), b (bottom) */
const FLOWS = [
 {id:"core", name:"Core power 5 V → VDD", color:"#ff8a3d", pts:[[84.6,66.6,"t"],[90,66,"t"],[90,66,"b"],[96.6,65,"b"],[93.6,77.6,"b"],[100.3,85.3,"b"],[108.9,86,"b"],[106,100,"b"],[105.7,108,"b"],[105.6,113,"b"],[105.6,116.5,"t"]], n:26, speed:.22},
 {id:"rails", name:"Logic rails 3V3 · 1V2 · 0V8", color:"#ffc46b", multi:[
   [[90,66,"b"],[104,60,"b"],[112.6,63.4,"b"],[116,68,"b"],[117.4,72.6,"t"]],
   [[96.6,66,"b"],[96,100,"b"],[104,126,"b"],[111,130.2,"b"],[109,122,"b"],[105.6,119,"t"]],
   [[96.6,66,"b"],[94,104,"b"],[98,126,"b"],[102.5,130.5,"b"],[103,122,"b"],[105,119,"t"]] ], n:10, speed:.18},
 {id:"uart", name:"ESP32 ⇄ ASIC UART (via U9)", color:"#4cc9e0", multi:[
   [[117.4,72.6,"t"],[118,90,"t"],[118.3,98,"t"],[118.3,100.1,"b"],[111,99.6,"b"],[107,112,"b"],[105.6,116.5,"t"]],
   [[105.6,116.5,"t"],[112,110,"b"],[119.6,108.3,"b"],[118.3,100.1,"b"],[118.3,98,"t"],[117,86,"t"],[117.4,72.6,"t"]] ], n:12, speed:.25},
 {id:"i2c", name:"I2C / PMBus (GPIO47/48)", color:"#a98bff", multi:[
   [[117.4,72.6,"t"],[105,70,"t"],[98,74,"b"],[93.6,77.6,"b"]],
   [[117.4,72.6,"t"],[100,95,"t"],[95,120,"b"],[93.9,130,"b"]],
   [[117.4,72.6,"t"],[100,60,"t"],[88,52,"t"],[87.2,50.3,"t"]] ], n:9, speed:.22},
 {id:"clk", name:"25 MHz clock → CLKI", color:"#e0e36a", pts:[[114.7,125.2,"b"],[111,121,"b"],[107,118,"b"],[105.6,116.5,"t"]], n:8, speed:.5},
 {id:"thermal", name:"Thermal loop (diode → fan)", color:"#ff5d73", multi:[
   [[105.6,116.5,"t"],[99,121,"b"],[96.3,123.9,"b"],[93.9,130,"b"]],
   [[93.9,130,"b"],[91,137,"b"],[89.6,143.6,"t"]] ], n:9, speed:.22},
 {id:"usb", name:"USB-C → ESP32 native USB", color:"#7ce0a0", pts:[[80.9,83.3,"t"],[95,83,"t"],[108,78,"t"],[117.4,72.6,"t"]], n:8, speed:.25},
];

/* Guided tour */
const TOUR = [
 {t:"Meet the Bitaxe Gamma", side:"iso", refs:[], flows:[], cool:false,
  p:["The Gamma is an open-source Bitcoin miner built around one BM1370 ASIC, the same chip used 195 times inside a Bitmain Antminer S21 Pro. On its own it hashes at roughly 1.1–1.2 TH/s from a 5 V supply, drawing around 20 W.",
     "Everything here comes from the published KiCad design files. The top side carries the ESP32, the ASIC and the connectors. The bottom side carries the power stage. Use Next to follow how power, work and heat move through the board."]},
 {t:"Power enters at 5 V", side:"top", refs:["J1"], flows:["core"],
  p:["J1 is a 5.5 × 2.1 mm centre-positive barrel jack, and the board runs on 5 V DC only. The supply needs to deliver more than 4 A without sagging, which is why a 25–30 W adapter is recommended.",
     "The 5 V rail drops through to the bottom side and lands on two 47 µF bulk capacitors (C3, C4) beside the core regulator."]},
 {t:"The core regulator: 5 V → 1.15 V at high current", side:"bottom", refs:["U2","L1","C17","C18","C19","C20","C14","C15","C16","R12","C11"], flows:["core"],
  p:["U2, a TI TPS546D24A, is a digitally controlled buck converter. It switches 5 V through the 300 nH inductor L1 at 650 kHz, and output capacitors C14–C20 smooth the result into VDD, the ASIC core rail. The default is 1.15 V, at currents that can exceed 15 A.",
     "R12 and C11 form a snubber that damps ringing on the switch node. R13 and R14 carry a remote-sense measurement back from the load, so the regulator corrects for voltage lost in the copper."]},
 {t:"Talking PMBus to the regulator", side:"bottom", refs:["U2","T1","R15","R9","R8"], flows:["i2c"],
  p:["The ESP32 controls U2 over I2C/PMBus at address 0x24. Changing core voltage in AxeOS writes VOUT_COMMAND. Reading power, current and regulator temperature comes from U2's telemetry.",
     "Firmware sets protection limits: start at 4.8 V input, stop below 4.5 V, warn at 25 A, fault at 30 A. Above 105 °C on the regulator, the miner drops into overheat mode. PGOOD (GPIO11) and SMB_ALRT (GPIO13) report status back to the ESP32."]},
 {t:"Small rails: 3.3 V, 1.2 V and 0.8 V", side:"bottom", refs:["U3","U5","U6","C21","C23","C26","C27","C30","C31"], flows:["rails"],
  p:["Three linear regulators make the quiet supplies. U3 (RT9080) makes 3.3 V for the ESP32 and peripherals. U5 and U6 (MCP1824) make 1.2 V and 0.8 V for the ASIC's two I/O supplies.",
     "The 1.2 V rail also powers the 25 MHz oscillator and the ASIC side of the level shifter. These rails are kept separate from the noisy, high-current core rail."]},
 {t:"The BM1370 ASIC", side:"top", refs:["U8"], flows:[], cool:false,
  p:["U8 is the hashing engine. Firmware treats it as 128 cores made of 2040 small cores spread across 4 hash domains. Each small core tests about one nonce per clock, so hashrate ≈ frequency × 2040. At the default 525 MHz that is ≈1.07 TH/s; tuned boards reach about 1.2 TH/s.",
     "Core power enters through the big exposed VDD pad (31), with the large VSS pad (32) as ground. Open the ASIC in the inspector to see the full pinout and a hashrate calculator."]},
 {t:"The decoupling ladder", side:"bottom", refs:["C36","C34","C32","C28","C41","C44","C46","C48","C43","C37","C38","C39","C40"], flows:["core"],
  p:["Directly under the ASIC sits a chain of 1 µF capacitors. The ASIC's VDD1–VDD3 pins are internal tap points between its hash domains. The board bridges VDD → tap 1 → tap 2 → tap 3 → GND with one capacitor per step, on both sides of the chip.",
     "Around them, C43 (100 µF) and smaller capacitors hold VDD steady when the chip's current changes abruptly."]},
 {t:"A 25 MHz heartbeat", side:"bottom", refs:["U7","C29"], flows:["clk"],
  p:["U7 is a 25 MHz crystal oscillator running from 1.2 V. It feeds the ASIC's CLKI pin, and an internal PLL multiplies that up to the hashing clock. 525 MHz is 21 × 25 MHz.",
     "When you pick a new frequency in AxeOS, the firmware rewrites the ASIC's PLL registers and ramps the clock in steps."]},
 {t:"The ESP32-S3 controller", side:"top", refs:["U4"], flows:["usb"],
  p:["U4 is an ESP32-S3-WROOM-1 module with a dual-core 240 MHz CPU, 16 MB flash, 8 MB PSRAM and 2.4 GHz Wi-Fi. It runs ESP-Miner and serves the AxeOS dashboard.",
     "It connects to your Stratum pool, turns pool jobs into work for the ASIC, checks returned nonces, and submits shares. The USB-C port J5 wires only data to the ESP32's native USB for flashing and logs. It does not power the board."]},
 {t:"Crossing voltage domains: UART via U9", side:"bottom", refs:["U9","R21","C47","C49"], flows:["uart"],
  p:["The ESP32 works at 3.3 V and the ASIC's I/O at 1.2 V. U9, an SN74AVC4T774, translates between them: ESP TX → ASIC CI (commands and jobs), ASIC RO → ESP RX (nonces), and GPIO1 → NRSTI (reset).",
     "The link starts at 115200 baud and the firmware raises it to 1 Mbaud once the chip is detected."]},
 {t:"Cooling: temperature in, fan out", side:"bottom", refs:["U10","R22","R23","C50","R24","R25","J6"], flows:["thermal"],
  p:["The BM1370 has an on-die temperature diode (TEMP_P/N). U10, an EMC2101, measures it through a small RC filter and drives the fan's PWM line, reading RPM from the tachometer.",
     "Firmware runs the fan curve. If the ASIC goes above 75 °C it enters overheat mode and drops voltage and frequency to protect the chip."]},
 {t:"Heatsink and fan stack", side:"iso", refs:["U8","J6"], flows:[], cool:true, explode:true,
  p:["A 40 × 40 mm heatsink sits directly on the ASIC with thermal paste. The four 3.5 mm holes around the chip (H5–H8) bolt it down, and a 40 mm 5 V PWM fan sits on top.",
     "Active cooling is required. The heatsink alone cannot shed around 20 W. The view is exploded here so you can see the layers: chip, heatsink, then fan."]},
 {t:"User interface and expansion", side:"top", refs:["J3","SW1","SW2","J2","J5"], flows:["i2c"],
  p:["The OLED header J3 (GND, VCC, SCL, SDA) takes a 0.91\" SSD1306 display at I2C address 0x3C. RESET (SW1) pulls the ESP32's EN pin low. BOOT (SW2) pulls GPIO0 low for bootloader recovery. J2 is a Tag-Connect footprint for an ESP-PROG.",
     "On the bottom, J4 exposes 5 V and GPIO39–42 for accessories that use the Bitaxe Accessory Protocol (BAP)."]},
 {t:"The full mining loop", side:"iso", refs:["U4","U9","U8","U2","U10"], flows:["core","uart","i2c","thermal","clk"],
  p:["Here is everything running together. The pool sends a job over Wi-Fi. The ESP32 builds the work and sends it over UART to the BM1370. The ASIC sweeps nonces and version bits at about a terahash per second and returns any result that clears difficulty 256. The ESP32 then submits the ones that beat the pool's difficulty as shares.",
     "Meanwhile U2 holds the core voltage steady, U7 provides the clock and U10 keeps the chip cool. Switch to Free mode to explore any part on your own."]},
];

