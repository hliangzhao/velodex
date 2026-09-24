import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const transpile = (file) =>
  ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
const helpers = await import(
  `data:text/javascript;base64,${Buffer.from(transpile('../src/workshop.ts')).toString('base64')}`
);
const { newBuild, parseBuild, encodeBuild, decodeBuild, totals, gear, fitCheck, upgrade, slots } =
  helpers;
test('gear calculation uses circumference in millimeters and handles stationary or invalid input', () => {
  const g = gear(50, 25, 2100, 90);
  assert.equal(g.ratio, 2);
  assert.equal(g.development, 4.2);
  assert.equal(g.speed, 22.68);
  assert.equal(gear(34, 34, 2100, 0).speed, 0);
  for (const args of [
    [50, 0, 2100, 90],
    [50, 25, 0, 90],
    [NaN, 25, 2100, 90],
    [50, 25, 2100, -1],
    [50.5, 25, 2100, 90],
  ])
    assert.equal(gear(...args), null);
});
test('dream build counts missing values without turning them into known zeroes and shares no purchase progress', () => {
  const b = newBuild();
  b.title = '山路与海风 🚲';
  b.items.wheels = {
    choice: 'roval-rapide-clx3',
    custom: '',
    grams: '1305',
    yuan: '',
    checked: true,
  };
  b.items.pedals.grams = '0';
  b.items.pedals.weightMode = 'manual';
  assert.deepEqual(totals(b, 'grams'), { value: 1305, known: 2, total: 8 });
  assert.equal(totals(b, 'yuan').known, 0);
  const restored = decodeBuild(encodeBuild(b));
  assert.equal(restored.title, b.title);
  assert.equal(restored.items.wheels.choice, b.items.wheels.choice);
  assert.equal(restored.items.wheels.checked, false);
  assert.equal(b.items.wheels.checked, true);
  for (const value of [
    null,
    { version: 2 },
    { ...b, title: 'x'.repeat(51) },
    { ...b, items: { ...b.items, frame: { ...b.items.frame, grams: '-2' } } },
    { ...b, items: { ...b.items, tires: { ...b.items.tires, yuan: 'Infinity' } } },
  ])
    assert.throws(() => parseBuild(value));
  assert.throws(() => decodeBuild('x'.repeat(14001)));
  assert.throws(() => decodeBuild('broken'));
  const complete = newBuild();
  for (const [id] of slots) {
    complete.items[id].grams = '100';
    complete.items[id].weightMode = 'manual';
  }
  assert.equal(totals(complete, 'grams').value, 800);
  assert.equal(totals(complete, 'grams').known, 8);
});
test('pairing rejects known incompatibility and never infers approval from matching widths', () => {
  assert.equal(fitCheck('zipp-303-firecrest', 'gp5000-clincher').level, 'blocked');
  assert.equal(fitCheck('roval-rapide-clx3', 'gp5000-clincher').level, 'review');
  assert.equal(fitCheck('zipp-303-firecrest', 'gp5000-str').level, 'review');
  assert.equal(fitCheck('missing', 'gp5000-str').level, 'unknown');
  assert.equal(fitCheck('lun-hyper3-d45', 'vittoria-corsa-next').level, 'unknown');
  assert.match(fitCheck('lun-hyper3-d45', 'vittoria-corsa-next').title, /尚待核对/);
  assert.deepEqual(upgrade(1800, 1400, 6000), {
    saved: 400,
    percent: (400 / 1800) * 100,
    yuanPerGram: 15,
  });
  assert.equal(upgrade(1400, 1400, 6000).yuanPerGram, null);
  assert.equal(upgrade(null, 100, 10), null);
});
test('domestic reference prices are CNY, scoped to a frameset and independent of overseas complete-bike prices', () => {
  const data = JSON.parse(readFileSync(new URL('../src/data/china-prices.json', import.meta.url)));
  assert.equal(data.currency, 'CNY');
  assert.equal(data.market, '中国大陆');
  assert.equal(data.frames['tarmac-sl8'].amount, 38990);
  assert.equal(data.frames['tarmac-sl8'].unit, '一套车架组');
  assert.equal(new URL(data.frames['tarmac-sl8'].source).hostname, 'www.specialized.com.cn');
  assert.deepEqual(data.parts, {});
});
const modelCode = transpile('../src/buildStructure.ts').replace(
  "from 'three'",
  `from '${new URL('../node_modules/three/build/three.module.js', import.meta.url).href}'`,
);
const { buildStructure } = await import(
  `data:text/javascript;base64,${Buffer.from(modelCode).toString('base64')}`
);
test('structure studies contain finite surfaces and separate moving components through their full range', () => {
  for (const study of ['ratchet', 'rim'])
    for (const hooked of [false, true]) {
      const model = buildStructure(study, hooked);
      const ids = new Set();
      let vertices = 0;
      model.group.traverse((o) => {
        if (o.isMesh) {
          ids.add(o.userData.part);
          if (study === 'rim' && o.userData.part === 'rim') {
            o.geometry.computeBoundingBox();
            const box = o.geometry.boundingBox;
            assert.equal(box.max.y - box.min.y, hooked ? 51 : 40);
          }
          for (const attr of ['position', 'normal'])
            for (const value of o.geometry.attributes[attr]?.array || [])
              assert.ok(Number.isFinite(value), study);
          vertices += o.geometry.attributes.position.count;
        }
      });
      for (const id of study === 'ratchet'
        ? ['fixed', 'moving', 'spring', 'body', 'bearing', 'axle']
        : ['rim', 'tire', 'bead'])
        assert.ok(ids.has(id));
      assert.ok(vertices > 1000);
      for (const x of [0, 0.5, 1]) {
        model.update(x, 1.4, true);
        model.group.updateMatrixWorld(true);
        model.group.traverse((o) => {
          for (const value of o.matrixWorld.elements) assert.ok(Number.isFinite(value));
        });
      }
      model.group.traverse((o) => {
        if (o.isMesh || o.isLineSegments) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
    }
});

test('new parts distinguish tire pairs, saddle variants and incomplete groupset weights', () => {
  const { weightOf, defaultWeightVariant } = helpers;
  assert.equal(helpers.partSlot('saddles'), 'saddle');
  assert.equal(helpers.partSlot('handlebars'), undefined);
  const build = newBuild();
  const choose = (slot, id) => {
    build.items[slot].choice = id;
    build.items[slot].weightVariant = defaultWeightVariant(id);
    return weightOf(build.items[slot]);
  };
  assert.equal(choose('wheels', 'lun-hyper3-d45').grams, 1334);
  assert.equal(choose('tires', 'vittoria-corsa-next').grams, 610);
  assert.equal(choose('saddle', 'slr-boost-ti316').grams, 158);
  build.items.saddle.weightVariant = 'l3';
  assert.equal(weightOf(build.items.saddle).grams, 164);
  assert.equal(choose('groupset', 'magene-qed').origin, 'unknown');
  assert.equal(choose('cockpit', 'enve-ses-ar-handlebar').grams, null);
});

test('weight assistance applies sourced pair weights, preserves manual overrides and never forces missing values to zero', () => {
  const { weightOf, defaultWeightVariant, weightBreakdown } = helpers;
  const b = newBuild();
  b.items.wheels.choice = 'roval-rapide-clx3';
  b.items.tires.choice = 'vittoria-corsa-pro';
  b.items.tires.weightVariant = defaultWeightVariant('vittoria-corsa-pro');
  assert.equal(weightOf(b.items.tires).grams, 560);
  assert.deepEqual(totals(b, 'grams'), { value: 1865, known: 2, total: 8 });
  assert.deepEqual(weightBreakdown(b), { official: 2, manual: 0, skipped: 6 });
  b.items.tires.weightVariant = '32-para';
  assert.equal(weightOf(b.items.tires).grams, 610);
  b.items.tires.grams = '635';
  b.items.tires.weightMode = 'manual';
  assert.equal(weightOf(b.items.tires).grams, 635);
  b.items.tires.weightMode = 'skip';
  assert.equal(weightOf(b.items.tires).grams, null);
  assert.equal(totals(b, 'grams').known, 1);
  const restored = decodeBuild(encodeBuild(b));
  assert.equal(restored.items.tires.weightMode, 'skip');
  assert.equal(restored.items.tires.grams, '635');
  assert.equal(restored.items.tires.weightVariant, '32-para');
  restored.items.tires.weightMode = 'auto';
  assert.equal(weightOf(restored.items.tires).grams, 610);
  restored.items.tires.weightVariant = 'not-a-verified-size';
  assert.equal(weightOf(restored.items.tires).grams, null);
  const legacy = newBuild();
  for (const [s] of slots) {
    delete legacy.items[s].weightMode;
    delete legacy.items[s].weightVariant;
  }
  legacy.items.wheels.choice = 'roval-rapide-clx3';
  legacy.items.wheels.grams = '1340';
  legacy.items.tires.choice = 'vittoria-corsa-pro';
  legacy.items.tires.grams = '630';
  const migrated = parseBuild(legacy);
  assert.equal(migrated.items.wheels.weightMode, 'manual');
  assert.equal(weightOf(migrated.items.wheels).grams, 1340);
  assert.equal(weightOf(migrated.items.tires).grams, 630);
  assert.equal(weightOf(migrated.items.tires).reference, undefined);
  migrated.items.tires.weightMode = 'auto';
  assert.equal(weightOf(migrated.items.tires).grams, null);
  assert.throws(() =>
    parseBuild({
      ...b,
      items: { ...b.items, wheels: { ...b.items.wheels, weightMode: 'estimated' } },
    }),
  );
});
