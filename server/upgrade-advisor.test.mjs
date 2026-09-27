import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createApp, loadParts } from './app.mjs';
const source = ts.transpileModule(
  readFileSync(new URL('../src/upgrade-planner.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const {
  initialAdvisor,
  costSummary,
  planAdvice,
  parseAdvisor,
  numberOrNull,
  wheelWeightChange,
  candidateNote,
  quotePrice,
  priceLabel,
  referencePriceLabel,
  compareReferencePrices,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const products = loadParts().products;
const pick = (id, price = '', quantity = 1) => ({ id, price, quantity, version: '' });
test('AD7 example preserves unknown original wheel weight and user-reported bike baseline', () => {
  const s = initialAdvisor();
  assert.equal(s.bikePrice, '13980');
  assert.equal(s.bikeWeight, '8440');
  assert.equal(s.oldWheelWeight, '');
  assert.equal(s.sale, false);
  assert.equal(wheelWeightChange(s, products), null);
  for (const v of ['', ' ', '-1', 'NaN', 'Infinity', '1e9', '1000001'])
    assert.equal(numberOrNull(v), null, v);
  assert.equal(numberOrNull('0'), 0);
});
test('budget separates quantities, missing quotes, labor, consumables and one wheel resale range', () => {
  const s = initialAdvisor();
  s.picks = [pick('elilee-e44'), pick('igpsport-cad70', '', 2)];
  s.sale = true;
  s.installation = '100';
  s.adapters = '50';
  const cost = costSummary(s, products);
  assert.equal(cost.subtotal, 4798);
  assert.equal(cost.min, 2948);
  assert.equal(cost.max, 3948);
  assert.equal(cost.complete, true);
  s.picks.push(pick('voso-ultimate-cn'));
  assert.equal(costSummary(s, products).complete, false);
  assert.ok(costSummary(s, products).missing.includes('Ultimate 50 · 日本版'));
  s.picks = [pick('igpsport-cad70', '', 2)];
  assert.equal(costSummary(s, products).applySale, false);
  assert.equal(costSummary(s, products).min, 448);
  s.installation = '';
  assert.equal(costSummary(s, products).complete, false);
  s.installation = '0';
  s.adapters = '0';
  assert.equal(costSummary(s, products).complete, true);
  s.picks = [pick('elilee-e44', 'invalid')];
  assert.ok(costSummary(s, products).missing.includes('XXE E44'));
  s.picks = [pick('elilee-e44', '0')];
  s.resaleLow = '2000';
  s.resaleHigh = '1000';
  assert.equal(costSummary(s, products).validSale, false);
  assert.equal(costSummary(s, products).min, 0);
});
test('wheel weight change requires a selected wheel, positive same-scope numbers and explicit confirmation', () => {
  const s = initialAdvisor();
  s.picks = [pick('elilee-e44')];
  s.oldWheelWeight = '1800';
  s.newWheelWeight = '1360';
  assert.equal(wheelWeightChange(s, products), null);
  s.sameWeightScope = true;
  assert.deepEqual(wheelWeightChange(s, products), { saved: 440, bike: 8000 });
  s.oldWheelWeight = '';
  assert.equal(wheelWeightChange(s, products), null);
  s.oldWheelWeight = '1800';
  s.picks = [];
  assert.equal(wheelWeightChange(s, products), null);
});
test('pedal and cleat standards and shoe bolt patterns catch mismatches and redundant purchases', () => {
  const s = initialAdvisor();
  s.picks = [pick('magene-p715-k'), pick('shimano-sm-sh11'), pick('shimano-sh-rx600')];
  const warnings = planAdvice(s, products);
  assert.ok(warnings.some((x) => x.level === 'conflict' && x.text.includes('制式不匹配')));
  assert.ok(warnings.some((x) => x.level === 'conflict' && x.text.includes('鞋底孔位')));
  s.picks = [pick('magene-p715-s'), pick('shimano-pd-r7000')];
  assert.ok(planAdvice(s, products).some((x) => x.level === 'conflict' && x.text.includes('一对')));
  s.picks = [pick('shimano-pd-r7000'), pick('shimano-sm-sh11'), pick('shimano-sh-rc703')];
  assert.ok(!planAdvice(s, products).some((x) => x.level === 'conflict'));
  assert.ok(planAdvice(s, products).some((x) => x.text.includes('包含锁片')));
});
test('sensor needs react to owned equipment, power measurement and protocols', () => {
  const s = initialAdvisor();
  s.picks = [pick('magene-p515'), pick('igpsport-cad70'), pick('igpsport-bsc100max')];
  let notes = planAdvice(s, products);
  assert.ok(notes.some((x) => x.text.includes('可能重复')));
  assert.ok(notes.some((x) => x.text.includes('FC-R7100')));
  assert.ok(notes.some((x) => x.text.includes('记录心率')));
  s.ownedHeart = true;
  assert.ok(!planAdvice(s, products).some((x) => x.text.includes('希望记录心率')));
  const antOnly = {
    ...products.find((p) => p.id === 'magene-p515'),
    selection: { powerType: 'spider', cadence: true, protocols: ['ANT+'], notes: [] },
  };
  assert.ok(
    planAdvice(
      s,
      products.map((p) => (p.id === antOnly.id ? antOnly : p)),
    ).some((x) => x.level === 'conflict' && x.text.includes('协议')),
  );
  s.picks = [pick('garmin-rally-rs100')];
  assert.ok(planAdvice(s, products).some((x) => x.text.includes('左右发力比例')));
});
test('preference changes affect the candidate guidance without manufacturing performance scores', () => {
  const p = products.find((p) => p.id === 'elilee-x58');
  const s = initialAdvisor();
  s.route = 'wind';
  assert.match(candidateNote(p, s), /側风|侧风/);
  s.route = 'climb';
  assert.match(candidateNote(p, s), /1260 g/);
});
test('saved and shared plans validate ids, bounded text, booleans, quantities and unknown price fields', () => {
  const s = initialAdvisor();
  s.bike = '我的 AD7 🚲';
  s.picks = [pick('voso-ultimate-cn', '', 1)];
  s.picks[0].version = '2026 / 塔基待确认';
  const restored = parseAdvisor(JSON.stringify(s), products);
  assert.deepEqual(restored, s);
  assert.equal(restored.picks[0].price, '');
  for (const value of [
    null,
    [],
    { ...s, version: 2 },
    { ...s, route: 'unsafe' },
    { ...s, sale: 'yes' },
    { ...s, bike: 'x'.repeat(201) },
    { ...s, picks: [pick('missing')] },
    { ...s, picks: [pick('elilee-e44', '', -1)] },
    { ...s, picks: [pick('elilee-e44'), pick('elilee-e44')] },
  ])
    assert.equal(parseAdvisor(JSON.stringify(value), products), null);
  assert.equal(parseAdvisor('{broken', products), null);
  assert.equal(parseAdvisor('x'.repeat(20001), products), null);
});
test('overseas references never become RMB quotes without explicit input', () => {
  const s = initialAdvisor();
  s.installation = '0';
  s.adapters = '0';
  s.picks = [pick('voso-ultimate-cn'), pick('shimano-pd-r7000'), pick('elilee-e44')];
  assert.equal(costSummary(s, products).subtotal, 4500);
  assert.equal(costSummary(s, products).complete, false);
  assert.equal(costSummary(s, products).missing.length, 2);
  const voso = products.find((p) => p.id === 'voso-ultimate-cn');
  assert.equal(quotePrice(pick(voso.id), voso), null);
  assert.equal(quotePrice(pick(voso.id, '0'), voso), 0);
  assert.equal(quotePrice(pick(voso.id, 'invalid'), voso), null);
  s.picks[0].price = '4000';
  s.picks[1].price = '680';
  assert.equal(costSummary(s, products).subtotal, 9180);
  assert.equal(costSummary(s, products).complete, true);
});
test('price labels preserve currency, region and decimals; ordering does not compare unlike currencies', () => {
  const ids = ['voso-ultimate-cn', 'shimano-pd-r7000', 'elilee-e44'];
  const withoutPrice = products.find((p) => !p.price);
  const sorted = [...ids.map((id) => products.find((p) => p.id === id)), withoutPrice].sort(
    compareReferencePrices,
  );
  assert.deepEqual(
    sorted.map((p) => p.id),
    ['elilee-e44', 'shimano-pd-r7000', 'voso-ultimate-cn', withoutPrice.id],
  );
  assert.equal(priceLabel(withoutPrice), '');
  assert.equal(priceLabel(sorted[2]), 'JP¥132,000 · 日本代理商价');
  assert.equal(
    referencePriceLabel({ amount: 111.99, currency: 'USD', market: '美国', kind: 'official' }),
    'US$111.99 · 美国官网价',
  );
});
test('published prices have a region, currency, sales unit and source without editorial placeholders', () => {
  assert.ok(products.length >= 80);
  for (const p of products) {
    const v = p.price;
    assert.equal('chinaPrice' in p, false, p.id);
    if (!v) continue;
    assert.ok(v.market && v.scope && v.note && /^\d{4}-\d{2}-\d{2}$/.test(v.checkedAt), p.id);
    assert.equal(new URL(v.source).protocol, 'https:');
    assert.ok(['official', 'distributor', 'launch'].includes(v.kind));
    assert.ok(['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'CAD'].includes(v.currency));
    assert.ok(v.amount > 0 && Number.isFinite(v.amount));
  }
  assert.ok(products.filter((p) => p.price?.currency === 'CNY').length >= 27);
  assert.ok(products.filter((p) => p.price && p.price.currency !== 'CNY').length >= 21);
  for (const file of ['parts', 'catalog'])
    assert.doesNotMatch(
      readFileSync(new URL(`./data/${file}.json`, import.meta.url), 'utf8'),
      /待确认|待核实|待核对|待询价|待核验/,
    );
  assert.equal(products.find((p) => p.id === 'elilee-x46').selection.depthMm, 45);
  assert.deepEqual(products.find((p) => p.id === 'igpsport-bsc100max').selection.powerProtocols, [
    'BLE',
  ]);
  assert.deepEqual(products.find((p) => p.id === 'igpsport-bsc200-pro').selection.protocols, [
    'BLE',
  ]);
  assert.equal(products.find((p) => p.id === 'voso-ultimate-cn').selection.weightG, 1275);
  assert.equal(products.find((p) => p.id === 'voso-ultimate-cn').price.amount, 132000);
  assert.equal(products.find((p) => p.id === 'voso-ultimate-cn').price.currency, 'JPY');
  assert.equal(products.find((p) => p.id === 'magene-pes-p515-2025').price.kind, 'launch');
});
test('server exposes added categories and specification search for local frontend', async (t) => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const category of ['powermeters', 'computers', 'sensors', 'pedals', 'cleats', 'shoes']) {
    const response = await fetch(`${base}/api/parts?category=${category}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.products.length >= 3);
    assert.ok(data.products.every((p) => p.category === category));
  }
  const results = await (await fetch(`${base}/api/parts?category=cleats&q=SPD-SL`)).json();
  assert.equal(results.total, 3);
});
