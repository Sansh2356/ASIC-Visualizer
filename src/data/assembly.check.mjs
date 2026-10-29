// node src/data/assembly.check.mjs — checks step dependencies for every board with a guide.
import assert from 'node:assert/strict';
import '../data/boards.js';
import { ASSEMBLY, stepsFor, prereqs, setActs, stepActs, stepState, blockedBy, placedBy } from './assembly.js';

for (const id of Object.keys(ASSEMBLY)) {
  const steps = stepsFor(id), at = t => steps.findIndex(s => s.t.startsWith(t));
  const asic = at('Place the ASIC'), heat = at('Mount the heatsink'), paste = at('Apply thermal paste');
  const passives = at('Place the passives');
  const fan = steps.findIndex(s => s.place.includes('HS1:fan'));
  const pre = prereqs(steps);
  const all = k => stepActs(steps, k);

  assert.ok(pre[heat].includes(asic), `${id}: heatsink needs the ASIC`);
  assert.ok(pre[fan].includes(heat), `${id}: fan needs the heatsink`);
  assert.ok(steps.every(s => s.actPlace.length === s.do.length), `${id}: one placement list per action`);

  // A tick never ticks anything else: the fan stays locked until its steps are done.
  let done = setActs(steps, [], all(fan), true);
  assert.deepEqual(done, [], `${id}: locked step can't be ticked`);
  assert.ok(blockedBy(steps, done, fan).includes(heat));

  // One action places exactly its own part.
  done = setActs(steps, done, [all(asic)[0]], true);
  assert.equal(done.length, 1);
  assert.deepEqual([...placedBy(steps, done)], steps[asic].actPlace[0], `${id}: one action, one part`);
  assert.equal(stepState(steps, done, asic), all(asic).length > 1 ? 'some' : 'all');

  // Finish the chain in order, then untick one ASIC action: everything stacked on it resets.
  const finish = k => { pre[k].forEach(finish); done = setActs(steps, done, all(k), true); };
  [fan, passives].forEach(finish);
  assert.equal(stepState(steps, done, paste), 'all', `${id}: heatsink needed the paste first`);
  assert.equal(stepState(steps, done, fan), 'all', `${id}: fan unlocked once its steps are done`);
  done = setActs(steps, done, [all(asic)[0]], false);
  assert.ok([heat, fan, paste].every(k => stepState(steps, done, k) === 'none'), `${id}: untick cascades down`);
  assert.equal(stepState(steps, done, passives), 'all', `${id}: unrelated step stays ticked`);
  assert.ok(!placedBy(steps, done).has('HS1'));
}
console.log('assembly dependencies ok');
