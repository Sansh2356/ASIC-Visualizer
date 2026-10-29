// node src/data/assembly.check.mjs — checks step dependencies for every board with a guide.
import assert from 'node:assert/strict';
import '../data/boards.js';
import { ASSEMBLY, stepsFor, prereqs, setDone, placedBy } from './assembly.js';

for (const id of Object.keys(ASSEMBLY)) {
  const steps = stepsFor(id), at = t => steps.findIndex(s => s.t.startsWith(t));
  const asic = at('Place the ASIC'), heat = at('Mount the heatsink'), paste = at('Apply thermal paste');
  const fan = steps.findIndex(s => s.place?.includes('HS1:fan'));
  const pre = prereqs(steps);

  assert.ok(pre[heat].includes(asic), `${id}: heatsink needs the ASIC`);
  assert.ok(pre[fan].includes(heat), `${id}: fan needs the heatsink`);

  // Checking the fan out of order pulls in the heatsink and the ASIC.
  let done = setDone(steps, [], fan, true);
  assert.ok([fan, heat, asic].every(k => done.includes(k)), `${id}: check cascades up`);
  assert.ok(placedBy(steps, done).has('HS1:fan'));

  // Unchecking the ASIC resets everything stacked on it, but not unrelated steps.
  const passives = at('Place the passives');
  done = setDone(steps, [...done, paste, passives], asic, false);
  assert.ok(![asic, heat, fan, paste].some(k => done.includes(k)), `${id}: uncheck cascades down`);
  assert.ok(done.includes(passives), `${id}: unrelated step stays checked`);
  assert.ok(!placedBy(steps, done).has('HS1'));
}
console.log('assembly dependencies ok');
