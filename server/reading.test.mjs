import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { loadCatalog, loadParts } from './app.mjs';

const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/reading.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  },
);
const { airPower, massPowerSaving, readingTopics } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
const data = JSON.parse(readFileSync(new URL('../src/data/reading.json', import.meta.url), 'utf8'));
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('aero teaching model separates ground and relative air speed, retaining correct units', () => {
  near(airPower(36, 0.3), 183.75); // 10 m/s, density 1.225 kg/m³
  near(airPower(40, 0.3) / airPower(20, 0.3), 8);
  near(airPower(36, 0.3, 36), 735); // double air speed, unchanged ground speed: ×4, not ×8
  assert.equal(airPower(0, 0.3, 36), 0);
  assert.equal(airPower(36, 0), 0);
  assert.throws(() => airPower(20, 0.3, -5), RangeError);
  assert.throws(() => airPower(NaN, 0.3), RangeError);
});

test('weight teaching model converts percent grade to angle and keeps rolling separate', () => {
  const flat = massPowerSaving(36, 0, 1);
  assert.equal(flat.gravity, 0);
  near(flat.rolling, 0.392266);
  // A 100% gradient is 45°, not 90°. Useful to catch percent-as-angle mistakes.
  const steep = massPowerSaving(36, 100, 1);
  near(steep.gravity, 98.0665 / Math.sqrt(2));
  near(steep.rolling, flat.rolling / Math.sqrt(2));
  near(massPowerSaving(36, 6, 2).gravity, 2 * massPowerSaving(36, 6, 1).gravity);
  assert.deepEqual(massPowerSaving(0, 6, 1), { gravity: 0, rolling: 0 });
  assert.throws(() => massPowerSaving(20, -1, 1), RangeError);
});

test('reading articles preserve traceable sources and valid routes into catalog and workshop', () => {
  const bikes = new Set(loadCatalog().bikes.map((b) => b.id));
  const parts = new Set(loadParts().products.map((p) => p.id));
  const ids = new Set(data.articles.map((a) => a.id));
  const sources = new Set(data.sources.map((s) => s.id));
  assert.equal(ids.size, data.articles.length);
  assert.equal(sources.size, data.sources.length);
  for (const source of data.sources) assert.equal(new URL(source.url).protocol, 'https:');
  for (const a of data.articles) {
    assert.ok(['race', 'science'].includes(a.kind), a.id);
    assert.ok(
      readingTopics.some(([id]) => id === a.topic),
      a.id,
    );
    assert.match(a.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Set(a.sections.map((s) => s.id)).size, a.sections.length);
    assert.ok(a.sections.length >= 3 && a.sections.some((s) => s.sourceIds.length), a.id);
    for (const s of a.sections)
      for (const id of s.sourceIds) assert.ok(sources.has(id), `${a.id}: ${id}`);
    for (const id of a.bikeIds) assert.ok(bikes.has(id), `${a.id}: ${id}`);
    for (const id of a.productIds) assert.ok(parts.has(id), `${a.id}: ${id}`);
    for (const id of a.relatedIds) assert.ok(ids.has(id) && id !== a.id, `${a.id}: ${id}`);
    if (a.heroBikeId) assert.ok(bikes.has(a.heroBikeId) && a.heroCaption.includes('零售'), a.id);
    if (a.image)
      assert.ok(existsSync(new URL(`../public${a.image}`, import.meta.url)) && a.imageSource, a.id);
    for (const action of a.actions) {
      assert.ok(action.search.startsWith('?'), a.id);
      const params = new URLSearchParams(action.search);
      assert.ok(['workshop', 'parts', 'compare'].includes(params.get('view')), a.id);
      if (params.get('view') === 'workshop')
        assert.ok(
          ['gears', 'fit', 'interfaces', 'power', 'upgrade', 'structures'].includes(
            params.get('tool'),
          ),
        );
      for (const bike of (params.get('bikes') || '').split(',').filter(Boolean))
        assert.ok(bikes.has(bike));
    }
    assert.ok(a.boundary && a.takeaway);
    assert.ok(
      Number.isInteger(a.quiz.answer) &&
        a.quiz.answer >= 0 &&
        a.quiz.answer < a.quiz.options.length,
      a.id,
    );
  }
});
