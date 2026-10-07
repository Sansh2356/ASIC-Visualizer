export const GROUPS = {
  asic:    {name:"Hashing",              color:"--c-asic"},
  power:   {name:"Power conversion",     color:"--c-power"},
  control: {name:"Control & comms",      color:"--c-control"},
  thermal: {name:"Thermal",              color:"--c-thermal"},
  io:      {name:"Connectors & UI",      color:"--c-io"},
  passive: {name:"Passives",             color:"--c-passive"},
  test:    {name:"Test points",          color:"--c-test"},
  mech:    {name:"Board & mechanics",    color:"--c-mech"},
};

export const ESPM = "https://github.com/bitaxeorg/ESP-Miner";

export const PKG = {"0402":[1,0.5,0.45],"0603":[1.6,0.8,0.8],"0805":[2,1.25,1],"1206":[3.2,1.6,1.1],"1210":[3.2,2.5,2],"7343":[7.3,4.3,2.8],"CP8x10":[8.3,8.3,10],"CP6.3x7.7":[6.6,6.6,7.7]};

const PADS_BM1370 = [
 [1,"VDD3_0","tap"],[2,"VDD2_0","tap"],[3,"VDD1_0","tap"],[4,"VSS","gnd"],[5,"NRSTI","ctl"],[6,"CI","ctl"],[7,"RO","ctl"],[8,"CLKI","clk"],[9,"BI","ctl"],[10,"ROSC_SEL","strap"],[11,"LITE_PAD","strap"],[12,"INV_CLKO","clk"],[13,"PLL_VSS","gnd"],[14,"VDDIO_08_0","io"],[15,"VDDIO_12_0","io"],
 [16,"VDDIO_12_1","io"],[17,"VDDIO_08_1","io"],[18,"VSS","gnd"],[19,"PIN_MODE","strap"],[20,"TEMP_P","temp"],[21,"TEMP_N","temp"],[22,"BO","chain"],[23,"CLKO","chain"],[24,"RI","chain"],[25,"CO","chain"],[26,"NRSTO","chain"],[27,"VSS","gnd"],[28,"VDD1_1","tap"],[29,"VDD2_1","tap"],[30,"VDD3_1","tap"]];
const EXPOSED_VDD_VSS = n => [[n,"VDD","core power","--c-power"],[n+1,"VSS","ground / heat","--c-passive"]];

export const ASICS = {
  BM1370: {smallCores:2040, cores:128, clock:25, origin:"Antminer S21 Pro", pins:PADS_BM1370, exposed:EXPOSED_VDD_VSS(31)},
  BM1368: {smallCores:1276, cores:80, clock:25, origin:"Antminer S21", pins:PADS_BM1370, exposed:EXPOSED_VDD_VSS(31)},
  BM1366: {smallCores:894, cores:112, clock:25, origin:"Antminer S19 XP", exposed:EXPOSED_VDD_VSS(29), pins:[
   [1,"VDD1_0","tap"],[2,"VDD2_0","tap"],[3,"VDD3_0","tap"],[4,"VSS","gnd"],[5,"NRSTI","ctl"],[6,"BI","ctl"],[7,"RO","ctl"],[8,"CLKI","clk"],[9,"CI","ctl"],[10,"ADDR0","strap"],[11,"ADDR1","strap"],[12,"PLL_VSS","gnd"],[13,"VDDIO_08_0","io"],[14,"VDDIO_18_0","io"],
   [15,"VDDIO_18_1","io"],[16,"VDDIO_08_1","io"],[17,"VSS","gnd"],[18,"PIN_MODE","strap"],[19,"INV_CLKO","clk"],[20,"CO","chain"],[21,"CLKO","chain"],[22,"RI","chain"],[23,"BO","chain"],[24,"NRSTO","chain"],[25,"VSS","gnd"],[26,"VDD3_1","tap"],[27,"VDD2_1","tap"],[28,"VDD1_1","tap"]]},
  BM1397: {smallCores:672, cores:168, clock:25, origin:"Antminer S17 / T17", exposed:[[33,"VDD","core power","--c-power"],[34,"VSS","ground / heat","--c-passive"]], pins:[
   [1,"VDD3_0","tap"],[2,"VDD2_0","tap"],[3,"VDD1_0","tap"],[4,"ADDR0","strap"],[5,"ADDR1","strap"],[6,"ADDR2","strap"],[7,"TEST","strap"],[8,"BI","ctl"],[9,"NRSTI","ctl"],[10,"RO","ctl"],[11,"CI","ctl"],[12,"CLKI","clk"],[13,"PLL_VSS","gnd"],[14,"PLL_VDD","io"],[15,"VDDIO_08_0","io"],[16,"VDDIO_18_0","io"],
   [17,"VDDIO_18_1","io"],[18,"VDDIO_08_1","io"],[19,"VSS","gnd"],[20,"PIN_MODE","strap"],[21,"TEMP_N","temp"],[22,"TEMP_P","temp"],[23,"RF","chain"],[24,"TF","chain"],[25,"CLKO","chain"],[26,"CO","chain"],[27,"RI","chain"],[28,"NRSTO","chain"],[29,"BO","chain"],[30,"VDD1_1","tap"],[31,"VDD2_1","tap"],[32,"VDD3_1","tap"]]},
};

export const BOARDS = {};
export function registerBoard(b){
  b.BW = b.EDGE.x1 - b.EDGE.x0;
  b.BH = b.EDGE.y1 - b.EDGE.y0;
  b.BT = b.BT || 1.6;
  b.PASSIVES.forEach(p=>{ if(!p[9]) p[9] = 'bottom'; });
  b.TPS.forEach(t=>{ if(!t[4]) t[4] = 'bottom'; });
  BOARDS[b.id] = b;
}

export const partCount = b =>
  b.PARTS.filter(p=>!p.dnp && p.bom!==false).length +
  b.PASSIVES.filter(p=>p[1]!=='DNP').length;
