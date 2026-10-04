import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const result = await build({
  entryPoints: ['src/studio/model.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const m = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);
const parts = JSON.parse(readFileSync(new URL('./data/parts.json', import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url)));
const item = (id) => m.productItem(parts.products.find((p) => p.id === id));
test('a new studio plan has no model, price, weight, resale or interface assumptions', () => {
  const p = m.newPlan();
  assert.equal(p.bikeId, '');
  assert.equal(p.baselineWeight, '');
  assert.equal(p.resale, '');
  assert.equal(p.interfaces.crank, '');
  assert.deepEqual(p.items, []);
  assert.ok(m.parsePlan(p));
});
test('changing any bicycle clears old measurements and removed/retained equipment, keeps proposed purchases', () => {
  const p = m.newPlan();
  p.baselineWeight = '8200';
  p.resale = '1500';
  p.interfaces.rotor = '六钉';
  p.items = [
    item('elilee-e44'),
    { ...m.customItem(), action: 'remove' },
    { ...m.customItem(), action: 'keep' },
  ];
  for (const bike of catalog.bikes) {
    const next = m.selectBike(p, bike);
    assert.equal(next.bikeId, bike.id);
    assert.equal(next.baselineWeight, '');
    assert.equal(next.resale, '');
    assert.equal(next.interfaces.rotor, '');
    assert.equal(next.items.length, 1);
    assert.ok(m.parsePlan(next), bike.id);
  }
});
test('costs isolate currencies and use quantities without charging retained or removed parts', () => {
  const p = m.newPlan();
  p.items = [
    item('elilee-e44'),
    item('voso-ultimate-cn'),
    { ...item('elilee-e50'), action: 'keep' },
  ];
  p.labor = '100';
  p.consumables = '50';
  p.resale = '1200';
  assert.equal(m.estimate(p).net, 3450);
  assert.equal(m.estimate(p).missingPrices.length, 1);
  assert.equal(m.estimate(p).priceComplete, false);
  p.items[1].price = '5000';
  assert.equal(m.estimate(p).net, 8450);
  assert.equal(m.estimate(p).priceComplete, true);
  p.items[1].quantity = 2;
  assert.equal(m.estimate(p).net, 13450);
  p.mode = 'build';
  assert.equal(m.estimate(p).net, 14650);
  p.labor = '';
  assert.deepEqual(m.estimate(p).missingFees, ['工时与运费']);
});
test('weight is never a fabricated whole-bike total and worn equipment stays excluded', () => {
  const p = m.newPlan();
  p.items = [
    { ...item('elilee-e44'), weight: '1360' },
    { ...m.customItem('wheels'), action: 'remove', weight: '1800' },
    { ...m.customItem('shoes'), weight: '500' },
  ];
  p.baselineWeight = '8200';
  assert.equal(m.estimate(p).weight, null);
  p.weightAligned = true;
  assert.equal(m.estimate(p).weight, 7760);
  assert.equal(m.estimate(p).delta, -440);
  p.items[1].weight = '';
  assert.equal(m.estimate(p).weight, null);
  p.mode = 'build';
  assert.equal(m.estimate(p).weight, 1360);
});
test('share/file validation rejects injected fields and unsafe values while preserving Unicode', () => {
  const p = m.newPlan();
  p.title = '砾石与公路 🚲';
  p.items = [item('elilee-e44')];
  assert.deepEqual(m.decodePlan(m.encodePlan(p)), p);
  for (const value of [-1, NaN, Infinity, 1.5, 99]) {
    const q = structuredClone(p);
    q.items[0].quantity = value;
    assert.equal(m.parsePlan(q), null);
  }
  const q = structuredClone(p);
  q.items[0].source = 'javascript:alert(1)';
  assert.equal(m.parsePlan(q), null);
  assert.equal(m.decodePlan('a'.repeat(100001)), null);
  assert.equal(m.decodePlan('%%%'), null);
  assert.ok(!('injected' in m.parsePlan({ ...p, injected: 'bad' })));
  const duplicate = structuredClone(p);
  duplicate.items.push({ ...duplicate.items[0] });
  assert.equal(m.parsePlan(duplicate), null);
});
test('fit coordinate transformation responds to spacers and stem changes with the correct signs', () => {
  const b = catalog.bikes.find((b) => b.geometry.sizes.length),
    s = { ...m.fitDefaults(), bikeId: b.id, size: b.geometry.sizes[0].size };
  const a = m.fitCoordinates(s, catalog),
    t = m.fitCoordinates({ ...s, spacers: s.spacers + 10 }, catalog);
  assert.ok(t.bar.y > a.bar.y);
  assert.ok(t.bar.x < a.bar.x);
  assert.ok(Math.abs(Math.hypot(t.bar.x - a.bar.x, t.bar.y - a.bar.y) - 10) < 1e-7);
  const longer = m.fitCoordinates({ ...s, stem: s.stem + 10 }, catalog);
  assert.ok(longer.bar.x > a.bar.x);
  assert.equal(a.saddle.x, -s.setback);
  assert.ok(Math.abs(Math.hypot(a.saddle.x, a.saddle.y) - s.saddleHeight) < 1e-7);
  assert.equal(m.fitCoordinates({ ...s, bikeId: 'absent' }, catalog), null);
});
test('known interface and hookless conflicts are distinguished from gaps in coverage', () => {
  const p = m.newPlan();
  p.items = [item('zipp-404-firecrest'), item('gp5000-clincher')];
  p.interfaces.rotor = '六钉';
  const notes = m.checks(p, parts);
  assert.ok(notes.some((n) => n.level === 'conflict' && n.text.includes('无钩')));
  assert.ok(notes.some((n) => n.level === 'conflict' && n.text.includes('碟片接口')));
  assert.ok(notes.some((n) => n.level === 'check'));
});
