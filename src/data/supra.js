import { registerBoard, ASICS, PKG, ESPM } from "../data/index.js";
/* Bitaxe Supra: component positions, nets and descriptions (from bitaxeSupra KiCad files, supra-403 branch, + ESP-Miner).
   Generated with tools/kicad-extract.js; the layout matches the Gamma, so most part and passive text is shared with it. */

registerBoard((()=>{
const EDGE = {"x0":77.189,"x1":133.732,"y0":47.522,"y1":147.284,"r":2.54};
const PARTS = [
{ref:"J1",short:"5 V in",name:"5 V DC barrel jack",part:"Tensility 54-00164",pkg:"5.5 × 2.1 mm, centre positive",group:"io",side:"top",x:84.58,y:66.62,rot:90,dims:[9,14,11],mat:"jack",face:"-x",what:"Main power input. Everything on the board runs from this 5 V.",how:"5 V DC only; a higher voltage will damage the board. A 5 V supply of at least 4 A is recommended. Bulk capacitors C3/C4 (47 µF) sit at U2's input.",specs:[["Voltage","5 V DC only"],["Current","> 4 A recommended"],["Plug","5.5 × 2.1 mm (5.5 × 2.5 often fits)"],["Polarity","Centre positive"]],nets:["5V","GND"]},
 {ref:"J2",short:"Tag-Connect",name:"Tag-Connect programming pads",part:"TC2030-IDC-NL footprint",pkg:"2 × 3 pads, 1.27 mm",group:"io",side:"top",x:128.13,y:57.73,rot:180,dims:[4,2.6,0.05],mat:"pads",shape:"tagconnect",bom:false,what:"A connector-less programming footprint. A spring-pin Tag-Connect cable presses onto these pads.",how:"Exposes EN, 3.3 V, UART0 TX/RX, GND and IO0, so an ESP-PROG can flash or recover the ESP32 even when USB is not usable.",specs:[["Signals","EN · 3V3 · U0TXD · GND · U0RXD · IO0"]],nets:["EN","3V3","P_TX","P_RX","IO0"]},
 {ref:"J3",short:"OLED hdr",name:"OLED display header",part:"4-pin 2.54 mm header",pkg:"1 × 4",group:"io",side:"top",x:87.205,y:50.292,rot:180,dims:[10.16,2.54,8.5],mat:"header",what:"Plugs in a 0.91\" SSD1306 128 × 32 I2C OLED that shows hashrate, efficiency, IP address and status.",how:"Pinout GND, VCC (3.3 V), SCL, SDA, silkscreened next to the header. It shares the I2C bus with U2 and U10. The display sits at address 0x3C.",specs:[["Display","SSD1306 128×32, 0.91\""],["I2C","0x3C"],["Pins","GND · VCC · SCL · SDA"]],nets:["GND","3V3","SCL","SDA"]},
 {ref:"J4",short:"Accessory",name:"Accessory port",part:"6-pin 2.54 mm header",pkg:"1 × 6",group:"io",side:"bottom",x:99.172,y:51.054,rot:90,dims:[2.54,15.24,2.5],mat:"header",dnp:true,what:"An expansion header for add-ons.",how:"Carries 5 V, GND and ESP32 GPIO39–42. The header is not in the Supra BOM, so it is usually left unpopulated.",specs:[["Pin 1–2","5 V, GND"],["Pin 3–6","GPIO39, 40, 41, 42"],["Protocol","BAP UART (TX 39 / RX 40)"]],nets:["5V","GND","GPIO39–42"],links:[["BAP readme","https://github.com/bitaxeorg/ESP-Miner/blob/master/main/bap/bap_readme.md"]]},
 {ref:"J5",short:"USB-C",name:"USB-C port (data)",part:"GCT USB4105-GF-A",pkg:"USB-C receptacle, USB 2.0",group:"io",side:"top",x:80.865,y:83.26,rot:90,dims:[7.3,8.94,3.2],mat:"metal",face:"-x",shape:"usbc",what:"For flashing firmware and reading logs. It does not power the board.",how:"Only D+ and D− are wired, to the ESP32-S3's built-in USB Serial/JTAG on GPIO19/20. VBUS and the CC pins are not connected. Because there are no CC resistors, a USB-C-to-C cable from some hosts may not be detected; a USB-A-to-C cable avoids that.",specs:[["Data","USB 2.0 full speed → ESP32 native USB"],["VBUS","Not connected"],["CC1/CC2","Not connected"]],nets:["USB_D+","USB_D−","GND"]},
 {ref:"J6",short:"Fan",name:"Fan connector (4-pin)",part:"Molex 0470531000",pkg:"4-pin 2.54 mm",group:"thermal",side:"top",x:89.621,y:143.622,rot:0,dims:[10.2,5.8,6],mat:"fanconn",what:"Standard 4-pin PWM fan header. Active cooling is required; the heatsink alone is not enough.",how:"Pins: GND, 5 V, TACH, PWM. Use a 5 V PWM fan. A 12 V fan will spin too slowly and the board will overheat. The project suggests the Noctua NF-A4x10 5V PWM for quieter running. R25 pulls PWM high so the fan runs at full speed if the controller is not driving it.",specs:[["Pins","GND · 5V · TACH · PWM"],["Fan","40 mm, 5 V, 4-pin PWM"]],nets:["GND","5V","FAN_TACH","FAN_PWM"]},
 {ref:"J7",name:"Alt. fan connector (JST-SH)",part:"JST BM04B-SRSS-TB",pkg:"4-pin 1.0 mm SH",group:"thermal",side:"top",x:103.5,y:143,rot:0,dims:[6,4.25,2.9],mat:"fanconn",dnp:true,what:"An alternative small-pitch footprint for fans with JST-SH plugs.",how:"Wired in parallel with J6 (GND, 5 V, TACH, PWM). The BOM lists it without a part number.",specs:[["Pins","GND · 5V · TACH · PWM"],["Pitch","1.0 mm"]],nets:["GND","5V","FAN_TACH","FAN_PWM"]},
 {ref:"L1",short:"300 nH",name:"Buck output inductor",part:"Coilcraft SLC1175-301MEC (300 nH)",pkg:"SLC1175 flat-wire SMD",group:"power",side:"bottom",x:100.27,y:85.255,rot:0,dims:[11,7.6,5.2],mat:"inductor",mark:"R30",what:"Stores energy every switching cycle and smooths the chopped 5 V square wave from U2 into steady DC current for the ASIC.",how:"U2's switch node drives one end; the other end is VDD. The BOM part is the Coilcraft SLC1175-301MEC (300 nH).",specs:[["Inductance","300 nH"],["Between","SW node → VDD"],["BOM note","Footprint named SLC1175-271; BOM part is -301"]],nets:["SW","VDD"]},
 {ref:"SW1",short:"Reset",name:"RESET button",part:"CS1213AGF260",pkg:"SMD tact switch",group:"io",side:"top",x:130.186,y:104.448,rot:180,dims:[3.6,3,1.6],mat:"button",what:"Restarts the ESP32.",how:"Pulls the ESP32's EN pin to ground. EN normally rises through R16 (10 kΩ) and C22 (1 µF), which also gives a clean power-on reset delay.",specs:[["Signal","EN"]],nets:["EN","GND"]},
 {ref:"SW2",short:"Boot",name:"BOOT button",part:"CS1213AGF260",pkg:"SMD tact switch",group:"io",side:"top",x:130.082,y:113.155,rot:180,dims:[3.6,3,1.6],mat:"button",what:"Holds GPIO0 low. Hold it while pressing RESET to enter the ESP32 ROM bootloader for recovery flashing.",how:"While running, ESP-Miner also reads this button as user input, for example to cycle display screens or, held at boot, to restore settings.",specs:[["Signal","GPIO0 (strapping pin)"]],nets:["IO0","GND"]},
 {ref:"T1",name:"Analog-ground net tie",part:"Net-tie 0.25 mm",pkg:"copper bridge",group:"power",side:"bottom",x:90.825,y:77.85,rot:0,dims:[1,0.5,0.05],mat:"pads",bom:false,what:"Joins the regulator's quiet analog ground (AGND) to the main ground at one chosen point.",how:"Keeping the small-signal ground of U2 separate, then tying it to power ground at a single spot, stops the large switching currents from disturbing U2's voltage measurements.",specs:[["Joins","AGND ↔ GND"]],nets:["AGND","GND"]},
 {ref:"U2",short:"TPS546D24A",name:"Core voltage regulator",part:"TI TPS546D24ARVFR",pkg:"40-pin LQFN-CLIP",group:"power",side:"bottom",x:93.58,y:77.59,rot:90,dims:[7,5,1.5],mat:"ic",mark:"TPS546D24A",what:"A digitally controlled synchronous buck converter that turns the 5 V input into the ASIC's core rail (VDD).",how:"Same regulator and circuit as on the Gamma: it switches 5 V through L1, and the ESP32 sets the voltage and reads input voltage, current and temperature over PMBus (I2C 0x24). Supra 402/403 introduced this regulator; earlier Supras (401) used a TPS40305 trimmed by a DS4432U DAC.",specs:[["Input","4.5–5.5 V (board 5 V rail)"],["Output","VDD, 1166 mV default for the BM1368"],["I2C / PMBus","0x24"],["Status lines","PGOOD, SMB_ALRT → ESP32"]],nets:["5V","SW","VDD (via L1)","SDA/SCL","PGOOD","PMB_ALRT","AGND (net-tie T1)"],links:[["TPS546 driver","https://github.com/bitaxeorg/ESP-Miner/blob/master/main/power/TPS546.c"]]},
 {ref:"U3",short:"3V3 LDO",name:"3.3 V regulator",part:"Richtek RT9080-33GJ5",pkg:"TSOT-23-5",group:"power",side:"bottom",x:112.563,y:63.38,rot:0,dims:[2.9,1.6,1],mat:"ic",what:"Low-dropout linear regulator making the 3.3 V logic rail from 5 V.",how:"Feeds the ESP32-S3 module, the EMC2101 fan controller, the OLED, the 3.3 V side of the level shifter, and the I2C/PGOOD pull-ups.",specs:[["In → out","5 V → 3.3 V"],["Rated current","600 mA"],["Type","LDO, low quiescent current"]],nets:["5V","3V3","GND"]},
 {ref:"U4",short:"ESP32-S3",name:"ESP32-S3 controller",part:"Espressif ESP32-S3-WROOM-1-N16R8",pkg:"Module 18 × 25.5 mm, PCB antenna",group:"control",side:"top",x:117.43,y:72.61,rot:90,dims:[18,25.5,3.1],mat:"esp",face:"+x",mark:"ESP32-S3-WROOM-1",what:"The brain of the miner. It runs the open-source ESP-Miner firmware and the AxeOS web dashboard, connects to Wi-Fi, speaks Stratum to your pool, and feeds work to the ASIC.",how:"It gets jobs from the pool, builds block-header work and sends it to the BM1368 over UART. When nonces come back it checks them against the pool difficulty and submits shares. It also runs the control loops: core voltage through U2, fan and temperature through U10, the OLED, the buttons and overheat protection.",specs:[["CPU","Dual-core Xtensa LX7, up to 240 MHz"],["Memory","16 MB flash, 8 MB PSRAM (N16R8)"],["Radio","2.4 GHz Wi-Fi 802.11 b/g/n, Bluetooth LE"],["ASIC UART","GPIO17 TX → CI, GPIO18 RX ← RO"],["ASIC reset","GPIO1"],["I2C","GPIO47 SDA, GPIO48 SCL"],["VDD sense","GPIO2 (ADC1 ch1)"],["Native USB","GPIO19 D−, GPIO20 D+"],["Accessory","GPIO39–42"]],nets:["3V3","TX/RX","RST","SDA/SCL","PGOOD","PMB_ALRT","USB D+/D−","EN","IO0"],links:[["ESP-Miner firmware","https://github.com/bitaxeorg/ESP-Miner"],["Web flasher","https://bitaxeorg.github.io/bitaxe-web-flasher/"]]},
 {ref:"U5",short:"1V2 LDO",name:"1.2 V I/O regulator",part:"Microchip MCP1824T-1202E/OT",pkg:"SOT-23-5",group:"power",side:"bottom",x:110.981,y:130.229,rot:0,dims:[2.9,1.6,1.1],mat:"ic",what:"LDO making the 1.2 V rail for the ASIC's I/O ring.",how:"Supplies BM1368 VDDIO_12, the 25 MHz oscillator U7, and the 1.2 V side of the level shifter U9.",specs:[["In → out","5 V → 1.2 V"],["Rated current","300 mA"]],nets:["5V","1V2"]},
 {ref:"U6",short:"0V8 LDO",name:"0.8 V I/O regulator",part:"Microchip MCP1824T-0802E/OT",pkg:"SOT-23-5",group:"power",side:"bottom",x:102.53,y:130.47,rot:0,dims:[2.9,1.6,1.1],mat:"ic",what:"LDO making the 0.8 V rail for the ASIC's second I/O supply.",how:"Feeds BM1368 VDDIO_08. Keeping the two small I/O rails separate from the high-current core rail keeps them clean.",specs:[["In → out","5 V → 0.8 V"],["Rated current","300 mA"]],nets:["5V","0V8"]},
 {ref:"U7",short:"25 MHz",name:"25 MHz oscillator",part:"SX3M25.000E20F30THN",pkg:"3.2 × 2.5 mm SMD",group:"asic",side:"bottom",x:114.73,y:125.22,rot:90,dims:[3.2,2.5,0.9],mat:"metal",what:"The reference clock for the ASIC.",how:"Runs from the 1.2 V rail and drives BM1368 CLKI. Inside the ASIC a PLL multiplies the 25 MHz reference up to the hashing clock; 490 MHz is 19.6 × 25 MHz.",specs:[["Frequency","25 MHz"],["Supply","1.2 V"],["Drives","CLKI (ASIC pin 8)"]],nets:["1V2","CLKI"]},
 {ref:"U8",short:"BM1368",name:"BM1368 mining ASIC",part:"Bitmain BM1368",pkg:"32-pad QFN-style, 2 exposed pads",group:"asic",side:"top",x:105.611,y:116.546,rot:180,dims:[6.6,7.8,1],mat:"asic",mark:"BM1368",what:"The chip that does the mining. It runs SHA-256 double hashing over block headers, searching for a nonce that produces a hash below the target.",how:"It comes from Bitmain's Antminer S21. ESP-Miner treats it as 80 cores made of 1276 small cores across 4 hash domains, so hashrate ≈ frequency × 1276: the 490 MHz default gives ≈0.63 TH/s. Its pads have the same names and order as the later BM1370, but the package is narrower. Version rolling is done in hardware.",specs:[["Origin","Antminer S21 (Bitmain)"],["Chip ID","0x1368"],["Cores","80 cores / 1276 small cores"],["Hash domains","4"],["Default clock","490 MHz (options 400–575)"],["Default core V","1166 mV (options 1100–1300)"],["Bitmain efficiency claim","17.5 J/TH"],["ASIC difficulty","256"],["Temperature","On-die diode (TEMP_P/N) to U10"]],nets:["VDD (pad 31)","VSS (pad 32)","CI","RO","NRSTI","CLKI","TEMP_P/N","VDDIO 1V2 / 0V8","VDD1–3 taps"],note:"The Supra was the first Bitaxe to use this chip; it was taken from S21 hashboards because it was not sold on its own.",links:[["BM1368 driver (ESP-Miner)","https://github.com/bitaxeorg/ESP-Miner/blob/master/components/asic/bm1368.c"]]},
 {ref:"U9",short:"Level shift",name:"Logic level shifter",part:"TI SN74AVC4T774PWR",pkg:"TSSOP-16",group:"control",side:"bottom",x:118.29,y:100.13,rot:0,dims:[5,4.4,1.1],mat:"ic",mark:"AVC4T774",what:"Translates signals between the ESP32's 3.3 V logic and the ASIC's 1.2 V I/O. Without it the ESP32 would overdrive the ASIC pins and could not reliably read the ASIC's replies.",how:"A 4-bit dual-supply transceiver with per-channel direction control. Three channels are used: ESP TX → ASIC CI, ASIC RO → ESP RX, and the reset line → NRSTI. Unlike the Gamma there is no R21 pull-down on OE in the Supra layout.",specs:[["A side","3.3 V (ESP32)"],["B side","1.2 V (ASIC)"],["Channels used","3 of 4"],["OE","R21 20 kΩ to GND"]],nets:["TX→CI","RO→RX","RST→RST_N","3V3","1V2"]},
 {ref:"U10",short:"EMC2101",name:"Fan controller + temp sensor",part:"Microchip EMC2101-R-ACZL",pkg:"MSOP-8",group:"thermal",side:"bottom",x:93.895,y:129.99,rot:-90,dims:[3,3,1],mat:"ic",what:"Reads the ASIC's on-die temperature diode and drives the cooling fan.",how:"Its remote-diode inputs read the BM1368's TEMP_P/TEMP_N pins through R22/R23 with C50 as a filter. It drives the fan PWM and counts tach pulses. The ESP32 reads it over I2C (0x4C).",specs:[["I2C","0x4C"],["Temp input","ASIC TEMP_P/N (pins 20/21)"],["Fan","PWM out, TACH in"],["Supply","3.3 V"]],nets:["TEMP_DP/DN","FAN_PWM","FAN_TACH","SDA/SCL","3V3"]},
];

const PASSIVES = [
["C1","1 µF","0402",92.17,82.22,180,"U2-DRTN/U2-BP1V5","power","Bypass for U2's internal 1.5 V reference regulator (BP1V5).","bottom"],
 ["C2","10 µF","0805",96.6,69.35,0,"5V/GND","power","Input decoupling for U2.","bottom"],
 ["C3","47 µF","1210",96.6,63.3,0,"5V/GND","power","Bulk input capacitor at U2. It supplies the large pulse currents the buck converter draws each cycle.","bottom"],
 ["C4","47 µF","1210",96.6,66.55,0,"5V/GND","power","Bulk input capacitor at U2, paired with C3.","bottom"],
 ["C5","1 µF","0402",86.79,70.11,0,"AGND/U2-AVIN","power","With R11, an RC filter that cleans U2's analog supply (AVIN).","bottom"],
 ["C6","4700 pF","0402",96.57,74,0,"5V/GND","power","Very-high-frequency input decoupling at U2's power pins.","bottom"],
 ["C7","1 µF","0402",96.59,71.54,0,"5V/GND","power","High-frequency input decoupling for U2.","bottom"],
 ["C8","0.1 µF","0402",89.56,71.13,180,"U2-ENUVLO/AGND","power","Filters the EN/UVLO divider.","bottom"],
 ["C9","2200 pF","0402",96.57,72.76,0,"5V/GND","power","Very-high-frequency input decoupling at U2's power pins.","bottom"],
 ["C10","4.7 µF","0402",102.75,75.04,-90,"U2-VDD5/GND","power","Bypass for U2's internal 5 V gate-drive regulator (VDD5 pin).","bottom"],
 ["C11","1000 pF","0805",92.14,85.86,0,"C11-Pad1/SW","power","Switch-node RC snubber capacitor.","bottom"],
 ["C12","0.1 µF","0402",93.1,83.76,-90,"U2-BOOT/SW","power","Bootstrap capacitor. It lets U2 drive its high-side MOSFET gate above the input voltage.","bottom"],
 ["C13","100 pF","0402",87.63,77.49,-90,"U2-VOSNS/U2-GOSNS","power","Filters noise on the differential voltage-sense lines.","bottom"],
 ["C14","22 µF","0805",104.58,78.93,90,"VDD/GND","power","Output capacitor on the ASIC core rail.","bottom"],
 ["C15","22 µF","0805",100.36,78.91,90,"VDD/GND","power","Output capacitor on the ASIC core rail.","bottom"],
 ["C16","22 µF","0805",102.48,78.91,90,"VDD/GND","power","Output capacitor on the ASIC core rail.","bottom"],
 ["C17","100 µF","1206",108.89,90.91,0,"VDD/GND","power","Bulk output capacitor on VDD. Smooths ripple and holds up the rail during load steps.","bottom"],
 ["C18","100 µF","1206",108.91,87.66,0,"VDD/GND","power","Bulk output capacitor on VDD.","bottom"],
 ["C19","100 µF","1206",108.91,84.4,0,"VDD/GND","power","Bulk output capacitor on VDD.","bottom"],
 ["C20","100 µF","1206",108.91,81.12,0,"VDD/GND","power","Bulk output capacitor on VDD.","bottom"],
 ["C21","1 µF","0402",111.62,60.03,0,"5V/GND","power","Input capacitor for U3.","bottom"],
 ["C22","1 µF","0402",128.67,106.25,-90,"EN/GND","control","EN delay capacitor. Holds the ESP32 in reset until power is stable.","bottom"],
 ["C23","1 µF","0402",113.72,60.03,180,"3V3/GND","power","Output capacitor for U3 (3.3 V).","bottom"],
 ["C24","10 µF","0805",126.39,86.18,0,"3V3/GND","control","Bulk 3.3 V capacitor at the ESP32. Covers Wi-Fi transmit current bursts.","bottom"],
 ["C25","0.1 µF","0402",126.39,87.79,0,"3V3/GND","control","High-frequency 3.3 V decoupling at the ESP32.","bottom"],
 ["C26","1 µF","0402",110.961,132.739,0,"5V/GND","power","Input capacitor for U5.","bottom"],
 ["C27","1 µF","0402",102.42,132.84,0,"5V/GND","power","Input capacitor for U6.","bottom"],
 ["C28","1 µF","0402",113.93,109.86,180,"GND/VDD3_0","asic","Domain ladder, left side: last tap to ground.","bottom"],
 ["C29","0.1 µF","0402",114.79,128.01,180,"GND/1V2","asic","Decoupling for the 1.2 V rail near U7 and U5.","bottom"],
 ["C30","1 µF","0402",114.24,130.02,-90,"1V2/GND","power","Output capacitor for U5 (1.2 V).","bottom"],
 ["C31","1 µF","0402",105.75,130.47,-90,"0V8/GND","power","Output capacitor for U6 (0.8 V).","bottom"],
 ["C32","1 µF","0402",112.83,108.026,180,"VDD3_0/VDD2_0","asic","Domain ladder, left side: bridges two adjacent internal hash-domain taps.","bottom"],
 ["C33","1 µF","0402",111,122.31,90,"0V8/GND","asic","0.8 V decoupling at the ASIC I/O pins.","bottom"],
 ["C34","1 µF","0402",111.53,106.266,180,"VDD2_0/VDD1_0","asic","Domain ladder, left side: bridges two adjacent internal hash-domain taps.","bottom"],
 ["C35","1 µF","0402",112.14,122.31,90,"1V2/GND","asic","1.2 V decoupling at the ASIC I/O pins.","bottom"],
 ["C36","1 µF","0402",110.215,103.146,180,"VDD1_0/VDD","asic","Domain ladder, left side: bridges VDD to the first internal tap.","bottom"],
 ["C37","0.1 µF","0402",109.19,104.84,-90,"VDD/GND","asic","High-frequency VDD decoupling near the ASIC.","bottom"],
 ["C38","0.1 µF","0402",103.24,104.84,-90,"VDD/GND","asic","High-frequency VDD decoupling near the ASIC.","bottom"],
 ["C39","1 µF","0402",102.11,104.84,-90,"VDD/GND","asic","VDD decoupling near the ASIC.","bottom"],
 ["C40","1 µF","0402",108.072,104.84,-90,"VDD/GND","asic","VDD decoupling near the ASIC.","bottom"],
 ["C41","1 µF","0402",101.09,103.154,180,"VDD/VDD1_1","asic","Domain ladder, right side: bridges VDD to the first internal tap.","bottom"],
 ["C42","1 µF","0402",100.655,122.33,90,"U8-VDDIO_12_1/GND","asic","Bypass on ASIC pin 16 (VDDIO_12_1), which has no external feed.","bottom"],
 ["C43","100 µF","1206",105.67,104.85,-90,"VDD/GND","asic","Bulk VDD capacitor right under the ASIC's power entry.","bottom"],
 ["C44","1 µF","0402",99.961,106.284,180,"VDD1_1/VDD2_1","asic","Domain ladder, right side: bridges two adjacent internal taps.","bottom"],
 ["C45","1 µF","0402",99.525,122.34,90,"U8-VDDIO_08_1/GND","asic","Bypass on ASIC pin 17 (VDDIO_08_1), which has no external feed.","bottom"],
 ["C46","1 µF","0402",98.681,108.024,180,"VDD2_1/VDD3_1","asic","Domain ladder, right side: bridges two adjacent internal taps.","bottom"],
 ["C47","0.1 µF","0402",123.79,103.11,180,"1V2/GND","control","1.2 V decoupling at U9 (B side).","bottom"],
 ["C48","1 µF","0402",97.61,109.925,180,"VDD3_1/GND","asic","Domain ladder, right side: last tap to ground.","bottom"],
 ["C49","0.1 µF","0402",122.93,101.12,-90,"3V3/GND","control","3.3 V decoupling at U9 (A side).","bottom"],
 ["C50","470 pF","0402",93.96,125.94,180,"TEMP_DP/TEMP_DN","thermal","Filter capacitor across the remote-diode inputs. Rejects noise on the temperature reading.","bottom"],
 ["C51","47 µF","1210",102.045,141.29,-90,"5V/GND","thermal","Bulk 5 V capacitor for the fan supply.","bottom"],
 ["C52","0.1 µF","0402",97.56,137.64,180,"5V/GND","thermal","5 V decoupling near the fan connectors.","bottom"],
 ["C53","0.1 µF","0402",97.2,140.73,-90,"5V/GND","thermal","5 V decoupling near the fan connectors.","bottom"],
 ["R1","8.25 kΩ","0402",86.1,75.5,0,"U2-BP1V5/U2-MSEL1","power","Pin-strap divider for U2 MSEL1 (selects default switching and loop settings at power-up).","bottom"],
 ["R2","DNP","0402",85.62,72.1,0,"U2-BP1V5/U2-MSEL2","power","Unpopulated strap option for MSEL2.","bottom"],
 ["R3","DNP","0402",86.1,74.33,0,"U2-BP1V5/U2-ADRSEL","power","Unpopulated strap option for the PMBus address.","bottom"],
 ["R4","DNP","0402",86.1,73.36,0,"U2-BP1V5/U2-VSEL","power","Unpopulated strap option for VSEL.","bottom"],
 ["R5","14.7 kΩ","0402",88,75.72,0,"AGND/U2-MSEL1","power","Pin-strap divider for U2 MSEL1.","bottom"],
 ["R6","0 Ω","0402",88,72.1,180,"U2-MSEL2/AGND","power","Strap for U2 MSEL2.","bottom"],
 ["R7","DNP","0402",88.01,74.32,180,"U2-ADRSEL/AGND","power","Unpopulated strap option for the PMBus address.","bottom"],
 ["R8","3.74 kΩ","0402",89.56,70.1,180,"U2-ENUVLO/AGND","power","Bottom half of U2's EN/UVLO divider.","bottom"],
 ["R9","11.8 kΩ","0402",93.89,73.99,180,"5V/U2-ENUVLO","power","Top half of U2's EN/UVLO divider. Sets the input voltage at which the regulator is allowed to start.","bottom"],
 ["R10","68.1 kΩ","0402",88.01,73.17,180,"U2-VSEL/AGND","power","Strap for U2 VSEL, the default output voltage before firmware takes over.","bottom"],
 ["R11","10 Ω","0402",93.88,72.93,180,"5V/U2-AVIN","power","With C5, an RC filter that cleans U2's analog supply (AVIN).","bottom"],
 ["R12","1 Ω","1206",91.55,88.21,180,"GND/C11-Pad1","power","Switch-node RC snubber resistor. With C11 it damps ringing on SW, which reduces EMI and voltage spikes.","bottom"],
 ["R13","49.9 Ω","0402",86.09,77.64,180,"U2-GOSNS/GND","power","Remote-sense resistor for the ground side of the VDD measurement.","bottom"],
 ["R14","49.9 Ω","0402",86.09,76.57,0,"VDD/U2-VOSNS","power","Remote-sense resistor carrying the VDD measurement back to U2 (positive).","bottom"],
 ["R15","10 kΩ","0402",110.99,74.51,0,"PGOOD/3V3","control","Pull-up for U2's open-drain power-good output, read by ESP32 GPIO11.","bottom"],
 ["R16","10 kΩ","0402",127.24,106.26,90,"3V3/EN","control","EN pull-up. With C22 it forms the ESP32's power-on reset delay.","bottom"],
 ["R17","10 kΩ","0402",120.38,113.26,-90,"GND/BI","asic","Ties ASIC chain input BI low. Unused with a single chip.","bottom"],
 ["R18","DNP","0402",123.21,116.22,180,"GND/U8-ROSC_SEL","asic","Strap for ASIC ROSC_SEL (pin 10).","bottom"],
 ["R19","1 kΩ","0402",123.21,118.98,180,"GND/U8-LITE_PAD","asic","Strap for ASIC LITE_PAD (pin 11).","bottom"],
 ["R22","100 Ω","0402",93.38,124.36,90,"TEMP_DN/TEMP_N","thermal","Series resistor on the ASIC temperature-diode line (N).","bottom"],
 ["R23","100 Ω","0402",94.52,124.36,-90,"TEMP_P/TEMP_DP","thermal","Series resistor on the ASIC temperature-diode line (P).","bottom"],
 ["R24","5.6 kΩ","0402",94.07,135.71,0,"FAN_TACH/3V3","thermal","Pull-up for the fan's open-collector tachometer output.","bottom"],
 ["R25","10 kΩ","0402",98.64,140.75,90,"FAN_PWM/5V","thermal","Pulls the fan PWM line high, so the fan runs at full speed by default.","bottom"]
];
const TPS = [["TP1",82.39,70.94,"5V","bottom"],["TP2",82.31,62.1,"GND","bottom"],["TP3",101.98,91.23,"VDD","bottom"],["TP4",97.22,91.21,"GND","bottom"],["TP5",118.46,62.54,"EN","bottom"],["TP6",122.43,62.54,"P_TX","bottom"],["TP7",122.42,58.83,"P_RX","bottom"],["TP8",123.61,84.12,"3V3","bottom"],["TP9",122.44,55.09,"IO0","bottom"],["TP10",118.48,55.14,"GND","bottom"],["TP11",118.48,58.69,"3V3","bottom"],["TP13",110.99,96.64,"RST_N","bottom"],["TP14",110.99,99.61,"CI","bottom"],["TP15",119.55,108.28,"RO","bottom"],["TP16",122.86,113.98,"BI","bottom"],["TP17",120.9,116.06,"U8-ROSC_SEL","bottom"],["TP18",120.82,119.01,"U8-LITE_PAD","bottom"],["TP19",114.86,134.28,"1V2","bottom"],["TP20",106.36,134.23,"0V8","bottom"],["TP21",122.86,121.97,"U8-INV_CLKO","bottom"],["TP22",118.52,122.76,"CLKI","bottom"],["TP29",87.08,112.616,"NRSTO","bottom"],["TP30",89.89,114.52,"CO","bottom"],["TP31",87.08,115.554,"RI","bottom"],["TP32",89.89,117.31,"CLKO","bottom"],["TP33",87.08,118.492,"BO","bottom"],["TP34",89.86,120.48,"PIN_MODE","bottom"],["TP35",96.28,123.89,"TEMP_P","bottom"],["TP36",91.65,123.88,"TEMP_N","bottom"],["TP37",93.61,140.38,"FAN_TACH","bottom"],["TP38",90.3,140.41,"FAN_PWM","bottom"]];
const HOLES = [["H1",130.235,51.121,3,"pad"],["H2",80.808,51.054,3,"pad"],["H3",130.302,143.728,3,"pad"],["H4",80.705,143.831,3,"pad"],["H5",126.06,136.36,3.5,"hs"],["H6",84.71,94.91,3.5,"hs"],["H7",126.06,94.91,3.5,"hs"],["H8",84.71,136.36,3.5,"hs"]];
return {
  id:"supra", tab:"Supra", title:"Bitaxe Supra", h1:"Bitaxe <b>Supra</b> Explorer",
  sub:"BM1368 · rev 403 KiCad · 56.5 × 99.8 mm · 4-layer",
  stats:[["Hash","≈0.63 TH/s","@490 MHz"],["Input","5 V DC",""],["Core","1.166 V","default"]],
  topLayer:"B", EDGE, PARTS, PASSIVES, TPS, HOLES,
  HOLE_TEXT:{
 "pad": [
  "Corner mounting hole",
  "Plated 3 mm mounting hole tied to ground. Used to mount the board on a stand."
 ],
 "hs": [
  "Heatsink mounting hole",
  "3.5 mm hole, one of four on a ~41 mm square around the ASIC. Screws or springs through these clamp the 40 × 40 mm heatsink onto the chip."
 ]
},
  FLOWS:[
 {
  "id": "core",
  "name": "Core power 5 V → VDD",
  "color": "#ff8a3d",
  "pts": [
   [
    84.6,
    66.6,
    "t"
   ],
   [
    90,
    66,
    "t"
   ],
   [
    90,
    66,
    "b"
   ],
   [
    96.6,
    65,
    "b"
   ],
   [
    93.6,
    77.6,
    "b"
   ],
   [
    100.3,
    85.3,
    "b"
   ],
   [
    108.9,
    86,
    "b"
   ],
   [
    106,
    100,
    "b"
   ],
   [
    105.7,
    108,
    "b"
   ],
   [
    105.6,
    113,
    "b"
   ],
   [
    105.6,
    116.5,
    "t"
   ]
  ],
  "n": 26,
  "speed": 0.22
 },
 {
  "id": "rails",
  "name": "Logic rails 3V3 · 1V2 · 0V8",
  "color": "#ffc46b",
  "multi": [
   [
    [
     90,
     66,
     "b"
    ],
    [
     104,
     60,
     "b"
    ],
    [
     112.6,
     63.4,
     "b"
    ],
    [
     116,
     68,
     "b"
    ],
    [
     117.4,
     72.6,
     "t"
    ]
   ],
   [
    [
     96.6,
     66,
     "b"
    ],
    [
     96,
     100,
     "b"
    ],
    [
     104,
     126,
     "b"
    ],
    [
     111,
     130.2,
     "b"
    ],
    [
     109,
     122,
     "b"
    ],
    [
     105.6,
     119,
     "t"
    ]
   ],
   [
    [
     96.6,
     66,
     "b"
    ],
    [
     94,
     104,
     "b"
    ],
    [
     98,
     126,
     "b"
    ],
    [
     102.5,
     130.5,
     "b"
    ],
    [
     103,
     122,
     "b"
    ],
    [
     105,
     119,
     "t"
    ]
   ]
  ],
  "n": 10,
  "speed": 0.18
 },
 {
  "id": "uart",
  "name": "ESP32 ⇄ ASIC UART (via U9)",
  "color": "#4cc9e0",
  "multi": [
   [
    [
     117.4,
     72.6,
     "t"
    ],
    [
     118,
     90,
     "t"
    ],
    [
     118.3,
     98,
     "t"
    ],
    [
     118.3,
     100.1,
     "b"
    ],
    [
     111,
     99.6,
     "b"
    ],
    [
     107,
     112,
     "b"
    ],
    [
     105.6,
     116.5,
     "t"
    ]
   ],
   [
    [
     105.6,
     116.5,
     "t"
    ],
    [
     112,
     110,
     "b"
    ],
    [
     119.6,
     108.3,
     "b"
    ],
    [
     118.3,
     100.1,
     "b"
    ],
    [
     118.3,
     98,
     "t"
    ],
    [
     117,
     86,
     "t"
    ],
    [
     117.4,
     72.6,
     "t"
    ]
   ]
  ],
  "n": 12,
  "speed": 0.25
 },
 {
  "id": "i2c",
  "name": "I2C / PMBus (GPIO47/48)",
  "color": "#a98bff",
  "multi": [
   [
    [
     117.4,
     72.6,
     "t"
    ],
    [
     105,
     70,
     "t"
    ],
    [
     98,
     74,
     "b"
    ],
    [
     93.6,
     77.6,
     "b"
    ]
   ],
   [
    [
     117.4,
     72.6,
     "t"
    ],
    [
     100,
     95,
     "t"
    ],
    [
     95,
     120,
     "b"
    ],
    [
     93.9,
     130,
     "b"
    ]
   ],
   [
    [
     117.4,
     72.6,
     "t"
    ],
    [
     100,
     60,
     "t"
    ],
    [
     88,
     52,
     "t"
    ],
    [
     87.2,
     50.3,
     "t"
    ]
   ]
  ],
  "n": 9,
  "speed": 0.22
 },
 {
  "id": "clk",
  "name": "25 MHz clock → CLKI",
  "color": "#e0e36a",
  "pts": [
   [
    114.7,
    125.2,
    "b"
   ],
   [
    111,
    121,
    "b"
   ],
   [
    107,
    118,
    "b"
   ],
   [
    105.6,
    116.5,
    "t"
   ]
  ],
  "n": 8,
  "speed": 0.5
 },
 {
  "id": "thermal",
  "name": "Thermal loop (diode → fan)",
  "color": "#ff5d73",
  "multi": [
   [
    [
     105.6,
     116.5,
     "t"
    ],
    [
     99,
     121,
     "b"
    ],
    [
     96.3,
     123.9,
     "b"
    ],
    [
     93.9,
     130,
     "b"
    ]
   ],
   [
    [
     93.9,
     130,
     "b"
    ],
    [
     91,
     137,
     "b"
    ],
    [
     89.6,
     143.6,
     "t"
    ]
   ]
  ],
  "n": 9,
  "speed": 0.22
 },
 {
  "id": "usb",
  "name": "USB-C → ESP32 native USB",
  "color": "#7ce0a0",
  "pts": [
   [
    80.9,
    83.3,
    "t"
   ],
   [
    95,
    83,
    "t"
   ],
   [
    108,
    78,
    "t"
   ],
   [
    117.4,
    72.6,
    "t"
   ]
  ],
  "n": 8,
  "speed": 0.25
 }
],
  TOUR:[
 {
  "t": "Meet the Bitaxe Supra",
  "side": "iso",
  "refs": [],
  "flows": [],
  "cool": false,
  "p": [
   "The Supra is the 4th major Bitaxe revision and the first built around the BM1368 from the Antminer S21. At its 490 MHz default it hashes at about 0.63 TH/s from a 5 V supply.",
   "Revision 403 shares its layout with the Gamma that followed it; only the ASIC and its settings differ. Use Next to follow power, work and heat."
  ]
 },
 {
  "t": "5 V in, VDD out",
  "side": "bottom",
  "refs": [
   "J1",
   "U2",
   "L1",
   "C17",
   "C18",
   "C19",
   "C20"
  ],
  "flows": [
   "core"
  ],
  "p": [
   "5 V enters at J1. U2, a TPS546D24A buck, switches it through the 300 nH inductor L1 into VDD, the ASIC core rail (1166 mV by default).",
   "The ESP32 sets the voltage and reads telemetry over PMBus at address 0x24."
  ]
 },
 {
  "t": "Small rails",
  "side": "bottom",
  "refs": [
   "U3",
   "U5",
   "U6"
  ],
  "flows": [
   "rails"
  ],
  "p": [
   "U3 makes 3.3 V for the ESP32 and peripherals. U5 and U6 make the BM1368's 1.2 V and 0.8 V I/O rails."
  ]
 },
 {
  "t": "The BM1368 ASIC",
  "side": "top",
  "refs": [
   "U8"
  ],
  "flows": [],
  "cool": false,
  "p": [
   "U8 has 1276 small cores, so hashrate ≈ frequency × 1276. Its pads have the same names as the BM1370's. Open it in the inspector for the pinout and calculator."
  ]
 },
 {
  "t": "Clock, UART and the ESP32",
  "side": "iso",
  "refs": [
   "U7",
   "U9",
   "U4"
  ],
  "flows": [
   "clk",
   "uart"
  ],
  "p": [
   "U7 provides the 25 MHz reference. U9 translates the ESP32's 3.3 V UART to the ASIC's 1.2 V I/O. U4, the ESP32-S3, runs ESP-Miner and talks to your pool over Wi-Fi."
  ]
 },
 {
  "t": "Cooling",
  "side": "iso",
  "refs": [
   "U8",
   "J6",
   "U10"
  ],
  "flows": [
   "thermal"
  ],
  "cool": true,
  "explode": true,
  "p": [
   "U10, an EMC2101, reads the BM1368's on-die temperature diode and drives the fan on J6. A 40 × 40 mm heatsink sits on the chip; active cooling is required."
  ]
 }
],
  ART:{
 "logo": {
  "text": "Bitaxe",
  "sub": "Supra · 403",
  "x": 105.13,
  "y": 92
 },
 "keepout": [
  105.385,
  115.635,
  41.4
 ],
 "traces": {
  "top": [
   [
    [
     101,
     113
    ],
    [
     96,
     109
    ],
    [
     92,
     108
    ]
   ],
   [
    [
     110,
     113
    ],
    [
     115,
     109
    ],
    [
     120,
     108
    ]
   ],
   [
    [
     101,
     113.5
    ],
    [
     95.7,
     109.7
    ],
    [
     92,
     109.2
    ]
   ],
   [
    [
     110,
     113.5
    ],
    [
     115.3,
     109.7
    ],
    [
     120,
     109.2
    ]
   ],
   [
    [
     101,
     114
    ],
    [
     95.4,
     110.4
    ],
    [
     92,
     110.4
    ]
   ],
   [
    [
     110,
     114
    ],
    [
     115.6,
     110.4
    ],
    [
     120,
     110.4
    ]
   ],
   [
    [
     101,
     114.5
    ],
    [
     95.1,
     111.1
    ],
    [
     92,
     111.6
    ]
   ],
   [
    [
     110,
     114.5
    ],
    [
     115.9,
     111.1
    ],
    [
     120,
     111.6
    ]
   ],
   [
    [
     101,
     115
    ],
    [
     94.8,
     111.8
    ],
    [
     92,
     112.8
    ]
   ],
   [
    [
     110,
     115
    ],
    [
     116.2,
     111.8
    ],
    [
     120,
     112.8
    ]
   ],
   [
    [
     101,
     115.5
    ],
    [
     94.5,
     112.5
    ],
    [
     92,
     114
    ]
   ],
   [
    [
     110,
     115.5
    ],
    [
     116.5,
     112.5
    ],
    [
     120,
     114
    ]
   ],
   [
    [
     101,
     116
    ],
    [
     94.2,
     113.2
    ],
    [
     92,
     115.2
    ]
   ],
   [
    [
     110,
     116
    ],
    [
     116.8,
     113.2
    ],
    [
     120,
     115.2
    ]
   ],
   [
    [
     101,
     116.5
    ],
    [
     93.9,
     113.9
    ],
    [
     92,
     116.4
    ]
   ],
   [
    [
     110,
     116.5
    ],
    [
     117.1,
     113.9
    ],
    [
     120,
     116.4
    ]
   ],
   [
    [
     101,
     117
    ],
    [
     93.6,
     114.6
    ],
    [
     92,
     117.6
    ]
   ],
   [
    [
     110,
     117
    ],
    [
     117.4,
     114.6
    ],
    [
     120,
     117.6
    ]
   ],
   [
    [
     101,
     117.5
    ],
    [
     93.3,
     115.3
    ],
    [
     92,
     118.8
    ]
   ],
   [
    [
     110,
     117.5
    ],
    [
     117.7,
     115.3
    ],
    [
     120,
     118.8
    ]
   ],
   [
    [
     101,
     118
    ],
    [
     93,
     116
    ],
    [
     92,
     120
    ]
   ],
   [
    [
     110,
     118
    ],
    [
     118,
     116
    ],
    [
     120,
     120
    ]
   ],
   [
    [
     101,
     118.5
    ],
    [
     92.7,
     116.7
    ],
    [
     92,
     121.2
    ]
   ],
   [
    [
     110,
     118.5
    ],
    [
     118.3,
     116.7
    ],
    [
     120,
     121.2
    ]
   ],
   [
    [
     101,
     119
    ],
    [
     92.4,
     117.4
    ],
    [
     92,
     122.4
    ]
   ],
   [
    [
     110,
     119
    ],
    [
     118.6,
     117.4
    ],
    [
     120,
     122.4
    ]
   ],
   [
    [
     101,
     119.5
    ],
    [
     92.1,
     118.1
    ],
    [
     92,
     123.6
    ]
   ],
   [
    [
     110,
     119.5
    ],
    [
     118.9,
     118.1
    ],
    [
     120,
     123.6
    ]
   ],
   [
    [
     101,
     120
    ],
    [
     91.8,
     118.8
    ],
    [
     92,
     124.8
    ]
   ],
   [
    [
     110,
     120
    ],
    [
     119.2,
     118.8
    ],
    [
     120,
     124.8
    ]
   ],
   [
    [
     117,
     80
    ],
    [
     117,
     96
    ],
    [
     118,
     100
    ]
   ],
   [
    [
     112,
     72
    ],
    [
     100,
     80
    ],
    [
     93,
     90
    ]
   ]
  ],
  "bottom": [
   [
    [
     93.6,
     77.6
    ],
    [
     100.3,
     85.3
    ]
   ],
   [
    [
     100.3,
     85.3
    ],
    [
     108.9,
     86
    ],
    [
     108.9,
     81
    ],
    [
     108.9,
     91
    ]
   ],
   [
    [
     108.9,
     91
    ],
    [
     106,
     104.8
    ]
   ],
   [
    [
     112.6,
     63.4
    ],
    [
     117,
     70
    ]
   ],
   [
    [
     118.3,
     100.1
    ],
    [
     111,
     99.6
    ],
    [
     110,
     96.6
    ]
   ],
   [
    [
     93.9,
     130
    ],
    [
     96.3,
     123.9
    ]
   ],
   [
    [
     93.9,
     130
    ],
    [
     90.3,
     140.4
    ]
   ],
   [
    [
     111,
     130.2
    ],
    [
     114.7,
     125.2
    ]
   ],
   [
    [
     102.5,
     130.5
    ],
    [
     106.4,
     134.2
    ]
   ]
  ]
 },
 "silk": {
  "top": [
   [
    "RESET",
    130.1,
    108.4
   ],
   [
    "BOOT",
    130,
    117.1
   ],
   [
    "5VDC ⊖-C-⊕",
    84.6,
    75
   ],
   [
    "PWM TAC 5V GND",
    89.6,
    139.5
   ],
   [
    "GND VCC SCL SDA",
    87.2,
    54.4
   ]
  ],
  "bottom": [
   [
    "bitaxeSupra · open source · bitaxe.org",
    105.4,
    145.5
   ],
   [
    "5V GND 39 40 41 42",
    99.2,
    55.2
   ]
  ]
 }
},
  COOLERS:[
 {
  "ref": "HS1",
  "x": 105.385,
  "y": 115.635,
  "size": 40,
  "fins": 13,
  "finH": 8,
  "fan": 40,
  "under": [
   "U8"
  ],
  "data": {
   "short": "Cooler",
   "name": "Heatsink + 40 mm fan",
   "group": "thermal",
   "side": "top",
   "what": "A 40 × 40 mm aluminium heatsink sits directly on the ASIC with thermal paste and is clamped through the four 3.5 mm holes. A 40 mm 5 V 4-pin PWM fan mounts on top. The project suggests a good paste such as Thermal Grizzly Kryonaut and a quieter fan such as the Noctua NF-A4x10 5V PWM.",
   "specs": [
    [
     "Heatsink",
     "40 × 40 mm aluminium"
    ],
    [
     "Fan",
     "40 mm, 5 V, 4-pin PWM"
    ],
    [
     "Interface",
     "Thermal paste on the chip"
    ]
   ]
  }
 }
],
  asic:{"chip":"BM1368","count":1,"freqs":[400,425,450,475,485,490,500,525,550,575],"def":490},
  oled:{"header":"J3","x":87.205,"y":50.292},
  overview:{
 "kick": "bitaxeSupra · 4th major Bitaxe revision",
 "h2": "The first Bitaxe with the BM1368",
 "intro": "The Supra pairs a Bitmain BM1368 (from the Antminer S21) with an ESP32-S3 controller on a 4-layer, 1.6 mm board. Revision 403 shown here shares its layout with the later Gamma, which swapped in the BM1370.",
 "grid": [
  [
   "≈0.63 TH/s",
   "at the 490 MHz default"
  ],
  [
   "5 V",
   "DC input"
  ],
  [
   "1.166 V",
   "default core rail (VDD)"
  ]
 ],
 "subsystems": [
  [
   "asic",
   "BM1368, 25 MHz clock, decoupling ladder"
  ],
  [
   "power",
   "TPS546D24A buck + L1; 3V3, 1V2 and 0V8 LDOs"
  ],
  [
   "control",
   "ESP32-S3, level shifter, I2C bus"
  ],
  [
   "thermal",
   "EMC2101 (reads the ASIC's diode), fan headers"
  ],
  [
   "io",
   "Barrel jack, USB-C, OLED header, buttons"
  ]
 ],
 "construction": [
  [
   "Layers",
   "4 copper, 1.6 mm FR-4"
  ],
  [
   "Rules",
   "6 mil trace/space, 0.3 mm holes"
  ],
  [
   "Copper",
   "1 oz outer / 0.5 oz inner suggested"
  ],
  [
   "Assembly",
   "Parts on both sides; reflow each side"
  ]
 ],
 "links": [
  [
   "bitaxeSupra repo",
   "https://github.com/bitaxeorg/bitaxeSupra"
  ],
  [
   "ESP-Miner",
   "https://github.com/bitaxeorg/ESP-Miner"
  ]
 ],
 "note": "Positions, packages and connections come from the published KiCad files (supra-403 branch). Bodies are simplified; heatsink, fan and OLED are generic stand-ins."
},
  diagram:{
 "caps": [
  [
   "POWER",
   20
  ],
  [
   "HASHING",
   420
  ],
  [
   "CONTROL &amp; I/O",
   780
  ]
 ],
 "blocks": [
  [
   "J1",
   20,
   50,
   170,
   56,
   "5 V DC input",
   "J1 · barrel jack",
   "core"
  ],
  [
   "U2",
   20,
   150,
   170,
   62,
   "TPS546D24A",
   "U2 · buck · PMBus 0x24",
   "core"
  ],
  [
   "L1",
   20,
   250,
   170,
   56,
   "L1 + output caps",
   "300 nH · C14–C20",
   "core"
  ],
  [
   "U3",
   220,
   50,
   160,
   56,
   "3.3 V LDO",
   "U3 · RT9080",
   "rails"
  ],
  [
   "U5",
   220,
   150,
   160,
   56,
   "1.2 V LDO",
   "U5 · MCP1824",
   "rails"
  ],
  [
   "U6",
   220,
   250,
   160,
   56,
   "0.8 V LDO",
   "U6 · MCP1824",
   "rails"
  ],
  [
   "U8",
   420,
   230,
   200,
   150,
   "BM1368 ASIC",
   "U8 · 1276 small cores",
   "asic"
  ],
  [
   "U7",
   420,
   440,
   200,
   56,
   "25 MHz oscillator",
   "U7 → CLKI",
   "clk"
  ],
  [
   "U9",
   660,
   150,
   160,
   62,
   "Level shifter",
   "U9 · 3.3 V ⇄ 1.2 V",
   "uart"
  ],
  [
   "U4",
   860,
   150,
   200,
   110,
   "ESP32-S3",
   "U4 · ESP-Miner / AxeOS",
   "uart"
  ],
  [
   "U10",
   660,
   440,
   160,
   62,
   "EMC2101",
   "U10 · I2C 0x4C",
   "thermal"
  ],
  [
   "J6",
   660,
   560,
   160,
   56,
   "40 mm 5 V fan",
   "J6 / J7 · PWM + TACH",
   "thermal"
  ],
  [
   "J3",
   860,
   320,
   200,
   56,
   "OLED 128×32",
   "J3 · I2C 0x3C",
   "i2c"
  ],
  [
   "J5",
   860,
   50,
   200,
   56,
   "USB-C (data only)",
   "J5 · GPIO19/20",
   "usb"
  ],
  [
   "J4",
   860,
   420,
   200,
   56,
   "Accessory port",
   "J4 · GPIO39–42 · BAP",
   "i2c"
  ],
  [
   "SW2",
   860,
   520,
   200,
   56,
   "RESET / BOOT",
   "SW1 → EN · SW2 → GPIO0",
   "i2c"
  ]
 ],
 "wires": [
  [
   "M105,106 L105,148",
   "core",
   "5 V",
   112,
   132
  ],
  [
   "M105,212 L105,248",
   "core",
   "SW node",
   112,
   236
  ],
  [
   "M105,306 L105,350 L418,350",
   "core",
   "VDD ≈1.15 V, up to ~20 A",
   200,
   343
  ],
  [
   "M190,78 L218,78",
   "rails"
  ],
  [
   "M190,78 L205,78 L205,178 L218,178",
   "rails"
  ],
  [
   "M205,178 L205,278 L218,278",
   "rails"
  ],
  [
   "M380,178 L400,178 L400,260 L418,260",
   "rails",
   "1V2 → VDDIO_12",
   404,
   222
  ],
  [
   "M380,290 L418,290",
   "rails",
   "0V8",
   386,
   284
  ],
  [
   "M380,90 L400,90 L400,130 L940,130 L940,148",
   "rails",
   "3V3 → ESP32 · U9 · U10 · OLED",
   430,
   124
  ],
  [
   "M520,438 L520,382",
   "clk",
   "CLKI",
   528,
   418
  ],
  [
   "M858,185 L822,185",
   "uart",
   "TX/RST",
   823,
   176
  ],
  [
   "M660,185 L640,185 L640,280 L622,280",
   "uart",
   "CI · NRSTI",
   570,
   176
  ],
  [
   "M622,330 L652,330 L652,205 L660,205",
   "uart",
   "RO",
   630,
   346,
   true
  ],
  [
   "M822,205 L858,205",
   "uart",
   "RX",
   830,
   222,
   true
  ],
  [
   "M900,262 L900,318",
   "i2c"
  ],
  [
   "M880,262 L880,300 L640,300 L640,600 L10,600 L10,181 L18,181",
   "i2c",
   "I2C / PMBus · SDA GPIO47 · SCL GPIO48",
   230,
   593
  ],
  [
   "M880,300 L740,300 L740,438",
   "i2c"
  ],
  [
   "M622,360 L700,360 L700,438",
   "thermal",
   "TEMP_P/N",
   628,
   376
  ],
  [
   "M740,502 L740,558",
   "thermal",
   "PWM / TACH",
   748,
   535
  ],
  [
   "M960,106 L960,148",
   "usb",
   "USB D+/D−",
   968,
   122
  ],
  [
   "M1060,448 L1080,448 L1080,205 L1062,205",
   "i2c"
  ],
  [
   "M1060,548 L1092,548 L1092,225 L1062,225",
   "i2c"
  ]
 ],
 "notes": [
  [
   "Wi-Fi 2.4 GHz → Stratum pool",
   872,
   232,
   "usb"
  ]
 ]
},
};
})());
