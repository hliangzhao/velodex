import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
async function bundle(path) {
  const r = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`
  );
}
const m = await bundle('src/studio/model.ts');
const s = await bundle('src/studio/sales.ts');
const q = await bundle('src/studio/quotes.ts');
const lib = await bundle('src/studio/library.ts');
const parts = JSON.parse(readFileSync('server/data/parts.json'));
const today = '2026-10-09';
function setup() {
  const p = m.newPlan();
  const item = m.productItem(parts.products.find((p) => p.id === 'farsports-c5-2025'));
  item.sales.attributes = { freehub: 'Shimano HG', axle: '12×100 / 12×142', rotor: 'Center Lock' };
  item.sales.included = '气嘴、胎垫';
  item.sales.excluded = '碟片、飞轮';
  p.items = [item];
  p.budget = '10000';
  p.notes = 'PRIVATE_NOTE';
  p.resale = '1000';
  const offer = q.createQuote(p, today);
  offer.merchant = '测试报价';
  offer.validUntil = '2026-10-12';
  offer.lines[0] = {
    ...offer.lines[0],
    price: '4999.99',
    match: 'same',
    stock: 'in-stock',
    warranty: '凭购买凭证，期限按商家说明',
  };
  offer.labor = '100';
  offer.shipping = '20.01';
  offer.consumables = '0';
  offer.discount = '120';
  offer.tax = 'included';
  return { p, offer };
}
test('sales profiles cover every catalogue entry and retain source, region and documented options', () => {
  for (const product of parts.products) {
    const profile = s.productProfile(product);
    assert.equal(profile.id, product.id);
    assert.equal(profile.source, product.source);
    assert.ok(profile.fields.length);
    assert.ok(s.parseSales(s.initialSales(profile)));
  }
  for (const f of lib.frames) {
    const profile = s.frameProfile(f);
    assert.deepEqual(profile.fields[0].options, f.sizes);
    assert.deepEqual(profile.fields[1].options, f.paints);
  }
  assert.deepEqual(
    s
      .productProfile(parts.products.find((p) => p.id === 'farsports-f1s'))
      .fields.find((f) => f.key === 'width').options,
    ['360 mm', '380 mm', '400 mm', '420 mm'],
  );
  assert.equal(
    s
      .productProfile(parts.products.find((p) => p.id === 'elilee-e50'))
      .fields.find((f) => f.key === 'freehub').value,
    undefined,
  );
});
test('sales selections survive plan export and share; old plans remain valid; non-new prices never default to retail', () => {
  const { p } = setup();
  assert.deepEqual(m.decodePlan(m.encodePlan(p)), p);
  for (const invalid of [null, undefined, 123, []]) {
    assert.equal(m.parsePlan({ ...p, items: [invalid] }), null);
  }
  const secondhand = m.applyPurchaseQuote(p.items[0], { condition: 'used', price: '2000' });
  assert.equal(secondhand.sales.condition, 'used');
  secondhand.price = '';
  assert.equal(m.unitPrice(secondhand), null);
  delete p.items[0].sales;
  assert.ok(m.parsePlan(p));
  p.items[0].sales = s.initialSales();
  p.items[0].sales.condition = 'takeoff';
  assert.equal(m.unitPrice(p.items[0]), null);
  assert.equal(m.validPurchaseQuote({ condition: 'takeoff', price: '' }), false);
  p.items[0].price = '0';
  assert.equal(m.unitPrice(p.items[0]), 0);
  p.items[0].sales.attributes = { constructor: 'malicious' };
  assert.equal(m.parsePlan(p), null);
});
test('quote arithmetic uses cents, separates fees, discount and tax, and excludes resale', () => {
  const { p, offer } = setup();
  assert.equal(q.assessQuote(offer, p, today).total, 5000);
  assert.equal(q.assessQuote(offer, p, today).comparable, true);
  offer.tax = 'extra';
  offer.taxAmount = '25.55';
  assert.equal(q.assessQuote(offer, p, today).total, 5025.55);
  offer.lines[0].quantity = 2;
  assert.equal(q.assessQuote(offer, p, today).total, 10025.54);
  assert.equal(q.assessQuote(offer, p, today).comparable, false);
});
test('missing or malformed prices and fees are never presented as complete totals', () => {
  for (const field of ['labor', 'shipping', 'discount', 'consumables']) {
    const { p, offer } = setup();
    offer[field] = '';
    assert.equal(q.assessQuote(offer, p, today).total, null, field);
  }
  for (const price of ['', 'NaN', '-1', '1e3', '1.123', '1000001']) {
    const { p, offer } = setup();
    offer.lines[0].price = price;
    assert.equal(q.assessQuote(offer, p, today).total, null);
  }
  const { p, offer } = setup();
  offer.discount = '999999';
  assert.equal(q.assessQuote(offer, p, today).total, null);
});
test('expiry, availability, scope, alternative products, conditions and warranty gate comparisons', () => {
  const mutations = [
    (o) => (o.validUntil = '2026-10-08'),
    (o) => (o.validUntil = '2026-02-30'),
    (o) => (o.date = '2026-10-10'),
    (o) => (o.validUntil = ''),
    (o) => (o.lines[0].stock = 'unavailable'),
    (o) => (o.lines[0].stock = 'unspecified'),
    (o) => (o.lines[0].stock = 'order'),
    (o) => (o.lines[0].match = 'alternative'),
    (o) => (o.lines[0].match = 'unreviewed'),
    (o) => (o.lines[0].condition = 'used'),
    (o) => (o.lines[0].warranty = ''),
    (o) => (o.request[0].sales.attributes.freehub = ''),
  ];
  for (const mutate of mutations) {
    const { p, offer } = setup();
    mutate(offer);
    assert.equal(q.assessQuote(offer, p, today).comparable, false);
  }
  const { p, offer } = setup();
  offer.lines[0].stock = 'order';
  offer.lines[0].leadTime = '7 个工作日';
  assert.equal(q.assessQuote(offer, p, today).comparable, true);
  assert.equal(q.assessQuote(offer, p, '2026-10-13').comparable, false);
});
test('purchase changes invalidate the quote snapshot while budgets and price edits do not', () => {
  const { p, offer } = setup();
  p.budget = '500';
  p.items[0].price = '4000';
  assert.equal(q.matchesRequest(offer, p), true);
  p.items[0].sales.attributes.freehub = 'XDR';
  assert.equal(q.matchesRequest(offer, p), false);
  assert.equal(offer.request[0].sales.attributes.freehub, 'Shimano HG');
  assert.equal(q.assessQuote(offer, p, today).comparable, false);
});
test('editing offered specifications resets the manual scope confirmation, price edits preserve it', () => {
  const { offer } = setup();
  for (const patch of [
    { quantity: 2 },
    { condition: 'used' },
    { offered: 'XDR' },
    { included: '无' },
    { excluded: '气嘴' },
  ]) {
    assert.equal(q.updateQuoteLine(offer.lines[0], patch).match, 'unreviewed');
  }
  assert.equal(q.updateQuoteLine(offer.lines[0], { price: '4500' }).match, 'same');
  assert.equal(q.updateQuoteLine(offer.lines[0], { quantity: 1 }).match, 'same');
});
test('quote documents omit private rider data and imports whitelist fields without accepting malformed requests', () => {
  const { p, offer } = setup();
  const doc = q.quoteDocument(offer);
  assert.ok(!doc.includes('PRIVATE_NOTE'));
  assert.ok(!doc.includes('budget'));
  assert.ok(!doc.includes('resale'));
  assert.deepEqual(q.readQuoteDocument(doc), offer);
  const raw = { ...offer, tracking: 'discard' };
  assert.equal(q.parseQuote(raw).tracking, undefined);
  for (const mutate of [
    (o) => o.lines.push(o.lines[0]),
    (o) => (o.lines[0].quantity = -1),
    (o) => (o.lines[0].price = '1e3'),
    (o) => (o.request[0].sales.condition = 'fake'),
    (o) => (o.request[0].source = 'javascript:alert(1)'),
  ]) {
    const broken = structuredClone(offer);
    mutate(broken);
    assert.equal(q.parseQuote(broken), null);
  }
  assert.throws(() => q.readQuoteDocument('{"format":"other"}'));
  assert.throws(() => q.readQuoteDocument('x'.repeat(512001)));
  const revised = q.reviseQuote(offer);
  assert.notEqual(revised.id, offer.id);
  assert.equal(revised.revisionOf, offer.id);
  revised.lines[0].price = '1';
  assert.equal(offer.lines[0].price, '4999.99');
  assert.match(q.quoteReport(offer, p, today), /5,000/);
});
