import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createApp, loadCatalog } from './app.mjs';

const catalog = loadCatalog();
test('every bike has its own eight component records, valid hotspots, sources and local image', () => {
  const ids = new Set();
  const required = [
    'frame',
    'shifters',
    'crank',
    'chainrings',
    'cassette',
    'power',
    'wheels',
    'tires',
  ];
  for (const bike of catalog.bikes) {
    assert.ok(!ids.has(bike.id), `duplicate bike: ${bike.id}`);
    ids.add(bike.id);
    assert.ok(catalog.brands.some((brand) => brand.id === bike.brandId));
    assert.deepEqual(bike.components.map((part) => part.id).sort(), [...required].sort(), bike.id);
    assert.ok(
      existsSync(new URL(`../public${bike.image}`, import.meta.url)),
      `missing image: ${bike.id}`,
    );
    assert.equal(new URL(bike.source).protocol, 'https:');
    for (const part of bike.components) {
      assert.ok(
        part.x > 0 && part.x < 100 && part.y > 0 && part.y < 100,
        `invalid hotspot: ${bike.id}/${part.id}`,
      );
      assert.ok(part.title && part.specs.length >= 2, `missing specs: ${bike.id}/${part.id}`);
    }
  }
});

test('catalog API filters and returns correct records without exposing arbitrary files', async (t) => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path) => fetch(`${base}${path}`);
  assert.equal((await get('/api/health')).status, 200);
  const classic = await (await get('/api/bikes?brand=specialized&collection=classic&q=SL7')).json();
  assert.equal(classic.total, 1);
  assert.equal(classic.bikes[0].id, 'tarmac-sl7');
  assert.equal((await (await get('/api/bikes?q=no-such-bike')).json()).total, 0);
  const power = await (await get('/api/bikes/tarmac-sl8/components/power')).json();
  assert.match(power.title, /4iiii/);
  assert.equal((await get('/api/bikes?collection=bad')).status, 400);
  const endurance = await (await get('/api/bikes?kind=' + encodeURIComponent('长途耐力'))).json();
  assert.deepEqual(
    endurance.bikes.map((b) => b.id),
    ['vanrysel-edr-cf', 'defy-pro0', 'endurace-slx8', 'scultura-endurance8000'],
  );
  assert.equal((await (await get('/api/bikes?q=' + encodeURIComponent('喜德盛'))).json()).total, 5);
  const decathlon = await (await get('/api/bikes?q=' + encodeURIComponent('迪卡侬'))).json();
  assert.deepEqual(
    decathlon.bikes.map((b) => b.id),
    ['vanrysel-edr-cf', 'vanrysel-rcr-pro'],
  );
  const meridaArchive = await (await get('/api/bikes?brand=merida&collection=classic')).json();
  assert.deepEqual(
    meridaArchive.bikes.map((b) => b.id),
    ['scultura8000', 'scultura-endurance8000'],
  );
  assert.equal((await get('/api/bikes?kind=a&kind=b')).status, 400);
  assert.equal((await get('/api/bikes?brand=a&brand=b')).status, 400);
  assert.equal((await get('/api/bikes/unknown')).status, 404);
  assert.equal((await get('/api/bikes/tarmac-sl8/components/missing')).status, 404);
  assert.equal((await get('/api/unknown')).status, 404);
  assert.equal((await get('/server/data/catalog.json')).status, 404);
});

test('frame sizes have valid reference dimensions and the expanded catalog spans road disciplines', () => {
  for (const bike of catalog.bikes) {
    const geometry = bike.geometry;
    assert.ok(
      geometry.sizes.some((g) => g.size === geometry.defaultSize),
      bike.id,
    );
    assert.equal(new Set(geometry.sizes.map((g) => g.size)).size, geometry.sizes.length);
    assert.equal(new URL(geometry.source).protocol, 'https:');
    assert.ok(bike.aero.description && bike.aero.limit);
    for (const g of geometry.sizes) {
      assert.ok(g.stack > 400 && g.stack < 750 && g.reach > 300 && g.reach < 500, bike.id);
      assert.ok(g.chainstay > g.bbDrop && g.headTube > 0, bike.id);
      assert.ok(g.wheelbase === null || (g.wheelbase > 850 && g.wheelbase < 1250), bike.id);
    }
  }
  for (const id of ['xlab-ad7', 'xlab-ad8', 'xlab-ad9', 'xlab-rs7', 'xlab-rt9', 'vanrysel-edr-cf'])
    assert.ok(catalog.bikes.some((b) => b.id === id));
  assert.ok(catalog.bikes.some((b) => b.kind === '轻量爬坡'));
  assert.ok(catalog.bikes.some((b) => b.kind === '长途耐力'));
});
