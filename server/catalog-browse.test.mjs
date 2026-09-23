import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { loadCatalog } from './app.mjs';
const catalog = loadCatalog();
const code = ts.transpileModule(
  readFileSync(new URL('../src/catalogBrowse.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const { filterBikes, groupBikes, yearLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const all = { brand: 'all', year: 'all', kind: 'all', collection: 'all', query: '' };
test('search includes market editions and both default and alternative paint names', () => {
  const base = catalog.bikes[0];
  const domestic = {
    ...base,
    id: 'domestic',
    edition: '中国大陆官网配置',
    color: '珍珠白',
    paints: [{ name: '环湖蓝' }],
  };
  const overseas = { ...base, id: 'overseas', edition: '美国版', color: '黑色', paints: [] };
  for (const query of ['中国大陆', '珍珠白', ' 环湖蓝 ']) {
    assert.deepEqual(
      filterBikes([domestic, overseas], catalog.brands, { ...all, query }).map((b) => b.id),
      ['domestic'],
    );
  }
  assert.equal(
    filterBikes([domestic], catalog.brands, { ...all, query: '环湖蓝', year: '1980' }).length,
    0,
  );
});
test('catalog groups keep every bike exactly once and sort known model years before undated builds', () => {
  for (const mode of ['brand', 'year']) {
    const groups = groupBikes(catalog.bikes, catalog.brands, mode);
    const ids = groups.flatMap((g) => g.bikes.map((b) => b.id));
    assert.equal(ids.length, catalog.bikes.length);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(groups.every((g) => g.bikes.length));
  }
  const years = groupBikes(catalog.bikes, catalog.brands, 'year');
  assert.equal(years.at(-1).id, 'unknown');
  assert.deepEqual(
    years.slice(0, -1).map((g) => +g.id),
    [...years.slice(0, -1).map((g) => +g.id)].sort((a, b) => b - a),
  );
  const example = [2020, null, 2026, 2023].map((modelYear, i) => ({
    ...catalog.bikes[0],
    id: String(i),
    modelYear,
  }));
  assert.deepEqual(
    groupBikes(example, catalog.brands, 'brand')[0].bikes.map((b) => b.modelYear),
    [2026, 2023, 2020, null],
  );
  const undated = {
    ...catalog.bikes[0],
    modelYear: null,
    edition: '官方配置 · 2026 核对',
    checkedAt: '2026-09-21',
  };
  assert.equal(yearLabel(undated), '年份未标注');
  assert.equal(filterBikes([undated], catalog.brands, { ...all, year: '2026' }).length, 0);
  assert.equal(filterBikes([undated], catalog.brands, { ...all, year: 'unknown' }).length, 1);
});
test('brand, year, category and search filters intersect without empty groups', () => {
  const results = filterBikes(catalog.bikes, catalog.brands, {
    ...all,
    brand: 'cannondale',
    year: '2025',
    kind: '长途耐力',
    query: ' Synapse ',
  });
  assert.deepEqual(
    results.map((b) => b.id),
    ['synapse-carbon2'],
  );
  assert.deepEqual(
    groupBikes(
      filterBikes(catalog.bikes, catalog.brands, { ...all, year: '2011' }),
      catalog.brands,
      'year',
    ),
    [],
  );
  assert.ok(filterBikes(catalog.bikes, catalog.brands, { ...all, query: '喜德盛' }).length >= 5);
  for (const b of catalog.bikes)
    assert.ok(
      b.modelYear === null ||
        (Number.isInteger(b.modelYear) && b.modelYear >= 1980 && b.modelYear <= 2100),
      b.id,
    );
});
test('every historical node and editorial chapter resolves to an existing local image', () => {
  const families = JSON.parse(
    readFileSync(new URL('../src/data/generations.json', import.meta.url)),
  );
  const stories = JSON.parse(readFileSync(new URL('../src/data/stories.json', import.meta.url)));
  for (const family of families)
    for (const node of family.nodes) {
      const image = node.image || catalog.bikes.find((b) => b.id === node.bikeId)?.image;
      assert.ok(
        image && existsSync(new URL(`../public${image}`, import.meta.url)),
        `${family.id}/${node.id}`,
      );
      if (node.image)
        assert.ok(node.imageCaption && new URL(node.imageSource).protocol === 'https:');
    }
  for (const story of stories)
    for (const id of [story.hero, ...story.chapters.map((ch) => ch.bikeId)]) {
      const bike = catalog.bikes.find((b) => b.id === id);
      assert.ok(bike && existsSync(new URL(`../public${bike.image}`, import.meta.url)), id);
    }
});
test('rider portraits preserve individual licenses, dated sources and consistent team-bike links', () => {
  const dossier = JSON.parse(readFileSync(new URL('../src/data/riders.json', import.meta.url)));
  const teams = JSON.parse(readFileSync(new URL('../src/data/teams.json', import.meta.url)));
  const licenses = JSON.parse(
    readFileSync(new URL('../docs/rider-photo-licenses.json', import.meta.url)),
  );
  assert.equal(new Set(dossier.riders.map((r) => r.id)).size, dossier.riders.length);
  for (const rider of dossier.riders) {
    const team = teams.teams.find((t) => t.id === rider.teamId);
    assert.ok(team, rider.id);
    assert.ok(
      rider.bikeIds.length && rider.bikeIds.every((id) => team.bikeIds.includes(id)),
      rider.id,
    );
    const p = rider.photo;
    assert.ok(existsSync(new URL(`../public${p.image}`, import.meta.url)), rider.id);
    assert.equal(new URL(p.licenseUrl).hostname, 'creativecommons.org');
    assert.equal(new URL(p.source).hostname, 'commons.wikimedia.org');
    assert.ok(p.author && p.title && p.caption && p.changes && p.year <= dossier.season);
    assert.ok(rider.watch && rider.tags.length && rider.recent.date <= dossier.checkedAt);
    for (const key of ['author', 'license', 'licenseUrl', 'source', 'original'])
      assert.equal(p[key], licenses.photos[rider.id][key]);
    assert.equal(new URL(rider.profile).protocol, 'https:');
    assert.equal(new URL(rider.recent.source).protocol, 'https:');
  }
  assert.equal(dossier.riders.find((r) => r.id === 'remco').teamId, 'redbull-bora');
});
