import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createApp, loadCatalog, loadParts } from './app.mjs';
const catalog = loadCatalog();
const parts = loadParts();
test('parts and paint records resolve to sourced local assets and valid cross-links', () => {
  assert.equal(new Set(parts.products.map((p) => p.id)).size, parts.products.length);
  for (const p of parts.products) {
    assert.ok(
      parts.brands.some((b) => b.id === p.brandId),
      p.id,
    );
    assert.ok(['wheels', 'groupsets', 'tires'].includes(p.category));
    assert.equal(new URL(p.source).protocol, 'https:');
    assert.ok(
      p.specs.length >= 4 && p.highlights.length >= 2 && p.compatibility && p.tradeoff,
      p.id,
    );
    if (p.image) assert.ok(existsSync(new URL(`../public${p.image}`, import.meta.url)), p.id);
  }
  for (const b of catalog.bikes) {
    assert.equal(new Set((b.paints || []).map((p) => p.id)).size, (b.paints || []).length, b.id);
    for (const p of b.paints || []) {
      assert.notEqual(p.id, 'default');
      assert.ok(existsSync(new URL(`../public${p.image}`, import.meta.url)), `${b.id}/${p.id}`);
      assert.equal(new URL(p.source).protocol, 'https:');
      assert.ok(p.imageRatio > 0 && p.name && p.hex);
      for (const [id, xy] of Object.entries(p.hotspots || {})) {
        assert.ok(b.components.some((c) => c.id === id));
        assert.ok(xy.x > 0 && xy.x < 100 && xy.y > 0 && xy.y < 100);
      }
    }
    for (const c of b.components)
      for (const id of c.catalogIds || [])
        assert.ok(
          parts.products.some((p) => p.id === id),
          `${b.id}/${c.id}/${id}`,
        );
    if (b.collections.includes('pro')) assert.equal(new URL(b.race.source).protocol, 'https:');
  }
});
test('parts API filters safely, supports detail links and rejects malformed queries', async (t) => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const get = (path) => fetch(`http://127.0.0.1:${server.address().port}${path}`);
  const wheels = await (await get('/api/parts?category=wheels&brand=zipp')).json();
  assert.deepEqual(
    wheels.products.map((p) => p.id),
    ['zipp-404-firecrest', 'zipp-303-firecrest'],
  );
  assert.equal((await (await get('/api/parts?q=' + encodeURIComponent('马牌'))).json()).total, 3);
  assert.equal((await (await get('/api/parts/105-r7100')).json()).category, 'groupsets');
  assert.equal((await get('/api/parts/missing')).status, 404);
  for (const query of [
    'category=bad',
    'category=wheels&category=tires',
    'brand=a&brand=b',
    'q=a&q=b',
  ])
    assert.equal((await get(`/api/parts?${query}`)).status, 400, query);
  const tt = await (await get('/api/bikes?kind=' + encodeURIComponent('TT 计时'))).json();
  assert.equal(tt.total, 2);
  assert.ok((await (await get('/api/bikes?collection=pro')).json()).bikes.every((b) => b.race));
});
