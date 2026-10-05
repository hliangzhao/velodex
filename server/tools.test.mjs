import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
const moduleFor = async (file) => {
  const r = await build({
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`
  );
};
const [b, m, t] = await Promise.all(
  ['src/studio/budget.ts', 'src/studio/model.ts', 'src/training.ts'].map(moduleFor),
);
const parts = JSON.parse(fs.readFileSync('server/data/parts.json'));
const product = (id) => parts.products.find((p) => p.id === id);
const needs = {
  category: 'wheels',
  replace: '',
  reserve: '300',
  sort: 'price',
  depth: 'any',
  map: false,
  power: 'any',
};
const plan = () => ({ ...m.newPlan('build'), budget: '8000', labor: '200', consumables: '100' });
test('budget includes other purchases, fees and reserve without pretending incomplete builds are complete', () => {
  const p = plan();
  p.items = [m.productItem(product('igpsport-bsc300t'))];
  const r = b.budgetOptions(p, parts, needs, {});
  assert.equal(r.allowance, 6701);
  assert.equal(r.valid, true);
  assert.ok(r.options.length);
  assert.ok(r.options.every((o) => o.cost <= 6701 && o.total.net + 300 <= 8000));
  assert.ok(r.options[0].total.coverage.includes('frame'));
  assert.equal(r.options[0].candidate.id, 'elilee-e50');
});
test('a quote gap blocks budget advice, while replacing that unknown quote can resolve the gap', () => {
  const p = plan();
  const unknown = m.customItem('wheels');
  unknown.name = '旧候选';
  p.items = [unknown];
  assert.equal(b.budgetOptions(p, parts, needs, {}).valid, false);
  const r = b.budgetOptions(p, parts, { ...needs, replace: unknown.key }, {});
  assert.equal(r.valid, true);
  assert.equal(r.options[0].next.items.length, 1);
  assert.equal(r.options[0].next.items[0].key, unknown.key);
  assert.equal(m.estimate(r.options[0].next).missingPrices.length, 0);
});
test('replacement preserves unrelated, retained and removed items, and invalid targets never add silently', () => {
  const p = plan();
  const wheel = m.productItem(product('elilee-e44'));
  const other = m.productItem(product('igpsport-bsc100s'));
  p.items = [
    wheel,
    other,
    { ...m.customItem('saddles'), action: 'keep' },
    { ...m.customItem('wheels'), action: 'remove' },
  ];
  const r = b.budgetOptions(p, parts, { ...needs, replace: wheel.key }, {});
  assert.ok(r.options.length);
  assert.deepEqual(r.options[0].next.items.slice(1), p.items.slice(1));
  const invalid = b.budgetOptions(p, parts, { ...needs, replace: 'gone' }, {});
  assert.equal(invalid.valid, false);
  assert.equal(invalid.options.length, 0);
});
test('overseas money needs an explicit RMB quote and tire quantity is priced correctly', () => {
  const p = plan();
  p.budget = '10000';
  assert.ok(
    !b
      .budgetOptions(p, parts, needs, {})
      .options.some((o) => o.candidate.id === 'voso-ultimate-cn'),
  );
  const r = b.budgetOptions(p, parts, needs, {
    'voso-ultimate-cn': { amount: 4500, date: '2026-10-05' },
  });
  const v = r.options.find((o) => o.candidate.id === 'voso-ultimate-cn');
  assert.equal(v.cost, 4500);
  assert.equal(v.next.items[0].price, '4500');
  assert.equal(v.next.items[0].reference.currency, 'JPY');
  const tires = b.budgetOptions(
    p,
    parts,
    { ...needs, category: 'tires' },
    { 'gp5000-str': { amount: 390, date: '2026-10-05' } },
  );
  assert.equal(tires.options[0].cost, 780);
  assert.equal(tires.options[0].next.items[0].quantity, 2);
});
test('hard requirements and known conflicts are filters, unknown weight is never treated as zero', () => {
  const p = plan();
  p.budget = '20000';
  const weights = b.budgetOptions(p, parts, { ...needs, sort: 'weight' }, {});
  assert.ok(weights.options.every((o) => Number(o.candidate.item.weight) > 0));
  const maps = b.budgetOptions(p, parts, { ...needs, category: 'computers', map: true }, {});
  assert.equal(maps.options[0].candidate.id, 'igpsport-bsc300t');
  const deep = b.budgetOptions(p, parts, { ...needs, depth: 'deep' }, {});
  assert.ok(deep.options.every((o) => o.candidate.product.selection.depthMm >= 55));
  p.interfaces.rotor = '六钉';
  const conflict = b.budgetOptions(p, parts, needs, {});
  assert.ok(conflict.mismatch > 0);
  assert.ok(!conflict.options.some((o) => o.candidate.id === 'farsports-c5-2025'));
});
test('local quotes are bounded and unknown fields are stripped', () => {
  assert.deepEqual(
    b.parseQuotes({
      good: { amount: 100, date: '2026-10-05', extra: 'ignored' },
      bad: { amount: -1, date: '2026-10-05' },
    }),
    { good: { amount: 100, date: '2026-10-05' } },
  );
});
const ride = (seconds = 3600, power = 200, step = 1) => ({
  format: 'TCX',
  discarded: 0,
  points: Array.from({ length: seconds / step + 1 }, (_, i) => ({
    time: i * step,
    segment: 0,
    power,
    heartRate: 140,
    cadence: 85,
  })),
});
test('steady power produces expected time-weighted NP, IF and TSS with zeroes included', () => {
  const r = t.trainingAnalysis(ride(), 250);
  assert.equal(r.coverage, 1);
  assert.equal(r.np, 200);
  assert.equal(r.intensity, 0.8);
  assert.ok(Math.abs(r.tss - 64) < 1e-9);
  assert.equal(r.zones[2].seconds, 3600);
  assert.equal(r.heartRate, 140);
  assert.equal(r.cadence, 85);
  const zero = t.trainingAnalysis(ride(600, 0), 250);
  assert.equal(zero.np, 0);
  assert.equal(zero.tss, 0);
  assert.equal(zero.zones[0].seconds, 600);
});
test('missing points, sparse samples and segment changes never become whole-session load', () => {
  for (const change of [
    (r) => {
      r.points[400].power = undefined;
    },
    (r) => {
      r.points.splice(300, 10);
    },
    (r) => {
      r.points.slice(300).forEach((p) => (p.segment = 1));
    },
  ]) {
    const input = ride(1200);
    change(input);
    const r = t.trainingAnalysis(input, 250);
    assert.equal(r.np, undefined);
    assert.equal(r.tss, undefined);
    assert.equal(r.peaks.find((p) => p.duration === 1200).watts, undefined);
  }
  const sparse = t.trainingAnalysis(ride(1200, 200, 5), 250);
  assert.equal(sparse.peaks[0].watts, undefined);
  assert.equal(sparse.peaks[1].watts, 200);
  assert.equal(t.trainingAnalysis(ride(300), 250).np, undefined);
  assert.equal(t.trainingAnalysis(ride(), 0).intensity, undefined);
});
test('peaks never bridge missing power and zones conserve actual covered duration', () => {
  const input = ride(1800, 200, 5);
  input.points[200].power = undefined;
  const r = t.trainingAnalysis(input, 250);
  assert.equal(r.missing, 10);
  assert.equal(
    r.zones.reduce((n, z) => n + z.seconds, 0),
    1790,
  );
  assert.equal(r.peaks.find((p) => p.duration === 1200).watts, undefined);
});
test('every workout uses its exact selected duration and never creates negative blocks', () => {
  for (const goal of ['recovery', 'endurance', 'tempo', 'threshold'])
    for (const minutes of [30, 45, 60, 90]) {
      const blocks = t.workout(goal, minutes);
      assert.equal(
        blocks.reduce((s, b) => s + b.minutes, 0),
        minutes,
      );
      assert.ok(blocks.every((b) => b.minutes > 0 && b.high >= b.low && b.low > 0 && b.high <= 1));
    }
});
test('training history validates values, deduplicates fingerprints and strips private fields', () => {
  const input = ride();
  const id = t.rideFingerprint(input);
  assert.equal(id, t.rideFingerprint(structuredClone(input)));
  const e = {
    id,
    name: '一次骑行',
    date: '2026-10-05',
    minutes: 60,
    ftp: 250,
    mean: 200,
    tss: 64,
    rpe: 4,
    source: 'meter',
    latitude: 30,
  };
  const history = t.parseTrainingHistory([e, e, { ...e, id: 'bad', rpe: 12 }]);
  assert.equal(history.length, 1);
  assert.ok(!('latitude' in history[0]));
});
