import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadCatalog } from './app.mjs';

const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/experience.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  },
);
const {
  emptyLibrary,
  parseLibrary,
  mergeLibrary,
  geometryFor,
  geometryPoints,
  resolveComparison,
  comparisonSearch,
  comparisonFromSearch,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const { bikes } = loadCatalog();
const record = {
  bikeId: 'tarmac-sl8',
  paintId: 'default',
  status: 'wanted',
  note: '喜欢这个轮廓。',
};

test('garage backup round-trips paints and notes, merges without overwriting and rejects invalid data', () => {
  const current = {
    ...emptyLibrary(),
    saved: [record],
    comparison: [{ bikeId: record.bikeId, size: '56' }],
  };
  assert.deepEqual(parseLibrary(JSON.stringify(current)), current);
  const incoming = {
    ...emptyLibrary(),
    saved: [
      { ...record, note: 'older note' },
      { ...record, bikeId: 'sworks-venge', status: 'owned' },
    ],
  };
  const merged = mergeLibrary(current, incoming);
  assert.equal(merged.saved.length, 2);
  assert.equal(merged.saved[0].note, record.note);
  assert.deepEqual(merged.comparison, current.comparison);
  for (const bad of [
    null,
    { version: 2 },
    { ...current, saved: [record, record] },
    { ...current, saved: [{ ...record, note: 'a'.repeat(1001) }] },
    { ...current, saved: [{ ...record, status: 'public' }] },
    { ...current, comparison: [...current.comparison, ...current.comparison] },
  ])
    assert.throws(() => parseLibrary(JSON.stringify(bad)));
  assert.throws(() => parseLibrary('not json'));
});

test('shared comparisons preserve independent sizes and order and safely resolve invalid links', () => {
  const entries = [
    { bikeId: 'tarmac-sl8', size: '54' },
    { bikeId: 'revolt-advanced0', size: 'M' },
    { bikeId: 'tarmac-sl6', size: '56' },
  ];
  assert.deepEqual(comparisonFromSearch(comparisonSearch(entries), bikes), entries);
  assert.deepEqual(
    comparisonFromSearch(
      '?view=compare&bikes=missing,tarmac-sl8,tarmac-sl8&sizes=M,INVALID,56',
      bikes,
    ),
    [{ bikeId: 'tarmac-sl8', size: geometryFor(bikes.find((b) => b.id === 'tarmac-sl8')).size }],
  );
  assert.equal(
    resolveComparison(
      bikes.slice(0, 5).map((bike) => ({ bikeId: bike.id, size: '' })),
      bikes,
    ).length,
    3,
  );
  assert.deepEqual(comparisonFromSearch('?view=compare&bikes=', bikes), []);
});

test('geometry overlay uses measured distances at a shared bottom bracket without inventing missing dimensions', () => {
  for (const bike of bikes)
    for (const g of bike.geometry.sizes) {
      const points = geometryPoints(g);
      assert.equal(points.headTop.x, g.reach);
      assert.equal(points.headTop.y, -g.stack);
      assert.ok(Math.abs(Math.hypot(points.rear.x, points.rear.y) - g.chainstay) < 1e-8);
      assert.ok(
        Math.abs(
          Math.hypot(
            points.headBottom.x - points.headTop.x,
            points.headBottom.y - points.headTop.y,
          ) - g.headTube,
        ) < 1e-8,
      );
      if (g.wheelbase == null) assert.equal(points.front, null, bike.id);
      else assert.ok(Math.abs(points.front.x - points.rear.x - g.wheelbase) < 1e-8, bike.id);
      assert.equal(points.seatMeasured, g.seatTube != null);
      assert.equal(points.front?.y ?? points.rear.y, -g.bbDrop);
    }
  const sl6 = geometryFor(
    bikes.find((b) => b.id === 'tarmac-sl6'),
    '56',
  );
  const sl7 = geometryFor(
    bikes.find((b) => b.id === 'tarmac-sl7'),
    '56',
  );
  const sl8 = geometryFor(
    bikes.find((b) => b.id === 'tarmac-sl8'),
    '56',
  );
  assert.deepEqual(
    [sl6.stack, sl6.reach, sl7.stack, sl7.reach, sl8.stack, sl8.reach],
    [565, 395, 555, 398, 565, 395],
  );
});

test('editorial collections reference available bikes and complete, shareable comparisons', () => {
  const stories = JSON.parse(
    readFileSync(new URL('../src/data/stories.json', import.meta.url), 'utf8'),
  );
  assert.equal(new Set(stories.map((story) => story.id)).size, stories.length);
  for (const story of stories) {
    for (const id of [
      story.hero,
      ...story.compare,
      ...story.chapters.map((chapter) => chapter.bikeId),
    ])
      assert.ok(
        bikes.some((bike) => bike.id === id),
        `${story.id}: missing ${id}`,
      );
    assert.ok(story.compare.length >= 2 && story.compare.length <= 3);
    assert.equal(new Set(story.compare).size, story.compare.length);
  }
});
