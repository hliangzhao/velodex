import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createApp } from './app.mjs';
import {
  emptyStory,
  storyMarkdown,
  parseRiderStory,
  exportRiderStories,
  safeStoryPhoto,
  consentMarker,
} from '../shared/rider-stories.mjs';
const story = {
  ...emptyStory(),
  title: '我的第一台车 #01',
  bike: 'Tarmac SL6',
  scene: '周末的山路\n雨后慢骑',
  reason: '为了骑得更远。\n### 我的车\n<script>alert(1)</script>',
  setup: '50/34 · 11–34，\\ 自选 [轮组]',
  upgrade: '',
  lesson: '买前先查接口。',
};
const photo = 'https://github.com/user-attachments/assets/01234567-89ab-cdef-0123-456789abcdef';
test('rider manuscripts round-trip editable text, require display consent and restrict photo origins', () => {
  const body = storyMarkdown(story);
  assert.deepEqual(parseRiderStory(body), story);
  assert.equal(parseRiderStory(body.replace(consentMarker, '')), null);
  assert.equal(parseRiderStory('just a comment'), null);
  assert.equal(parseRiderStory(body + '\n### 故事标题\n> injected'), null);
  assert.equal(parseRiderStory(body.replace('我的第一台车', '改过的标题')).title, '改过的标题 #01');
  assert.equal(
    parseRiderStory(body.replace('### 实车照片', `### 实车照片\n![实车](${photo})`)).photo,
    photo,
  );
  assert.equal(
    parseRiderStory(
      body.replace('### 实车照片', `### 实车照片\n<img width="1200" src="${photo}" alt="实车" />`),
    ).photo,
    photo,
  );
  for (const bad of [
    'javascript:alert(1)',
    'https://evil.test/photo.jpg',
    'https://github.com.evil.test/user-attachments/assets/01234567-89ab-cdef-0123-456789abcdef',
    'https://user-images.githubusercontent.com@evil.test/x.png',
    photo + '?track=1',
  ])
    assert.equal(safeStoryPhoto(bad), '');
  assert.throws(() => storyMarkdown({ ...story, title: 'x'.repeat(81) }));
  assert.throws(() => storyMarkdown({ ...story, reason: '' }));
});
test('story export uses GitHub attribution, drops hidden or withdrawn entries and preserves no private drafts', () => {
  const c = {
    id: 'real-id',
    body: storyMarkdown(story),
    author: { login: 'rider' },
    createdAt: '2026-09-20T00:00:00Z',
    url: 'https://github.com/hliangzhao/velodex/discussions/1#discussioncomment-123',
  };
  const out = exportRiderStories([
    c,
    { ...c, isMinimized: true },
    { ...c, body: c.body.replace(consentMarker, '') },
    { ...c, url: 'https://evil.test/' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].author, 'rider');
  assert.equal(out[0].id, 'real-id');
  assert.ok(!('body' in out[0]));
});
const code = ts.transpileModule(
  readFileSync(new URL('../src/interfaces.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const { emptyInterfaces, checkInterfaces, parseInterfaces, interfaceReport } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
test('interface checks distinguish known conflicts, conditional installation and missing specifications', () => {
  const empty = emptyInterfaces();
  assert.ok(checkInterfaces(empty).every((r) => r.status === 'unknown'));
  const cassette = (freehub, cassette) =>
    checkInterfaces({ ...empty, freehub, cassette }).find((r) => r.id === 'cassette');
  assert.equal(cassette('hg-l2', 'road11').status, 'blocked');
  assert.equal(cassette('hg-l2', 'road12').status, 'match');
  assert.equal(cassette('hg-l', 'road12').status, 'match');
  assert.equal(cassette('hg-l', 'hg700').status, 'review');
  assert.match(cassette('hg-l', 'hg700').text, /1.85/);
  assert.equal(cassette('xdr', 'xd-mtb').status, 'review');
  assert.equal(cassette('xd', 'xdr-road').status, 'blocked');
  assert.equal(cassette('micro', 'road12').status, 'blocked');
  assert.equal(cassette('', 'road12').status, 'unknown');
  const b = {
    ...empty,
    frameBB: 'bsa68',
    bbShell: 'pf86',
    crank: 'dub-wide',
    bbCrank: 'dub-road',
    frameAxle: 'ta12-142',
    rearHub: 'ta12-148',
    hubRotor: 'cl',
    rotor: 'six',
  };
  const result = checkInterfaces(b);
  assert.equal(result.find((r) => r.id === 'shell').status, 'blocked');
  assert.equal(result.find((r) => r.id === 'rear').status, 'blocked');
  assert.equal(result.find((r) => r.id === 'crank').status, 'review');
  assert.equal(result.find((r) => r.id === 'rotor').status, 'review');
  assert.equal(
    checkInterfaces({ ...b, hubRotor: 'six', rotor: 'cl' }).find((r) => r.id === 'rotor').status,
    'blocked',
  );
  assert.deepEqual(parseInterfaces(JSON.parse(JSON.stringify(b))), b);
  assert.throws(() => parseInterfaces({ ...empty, freehub: 'same-brand-means-compatible' }));
  assert.match(interfaceReport(b), /不是整车装配认证/);
});
test('generation archive has chronological sourced nodes and uses photographs only for matching catalog families', () => {
  const data = JSON.parse(readFileSync(new URL('../src/data/generations.json', import.meta.url)));
  const catalog = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url)));
  assert.deepEqual(
    data.map((f) => f.id),
    ['tarmac', 'madone', 'tcr'],
  );
  for (const f of data) {
    assert.ok(f.nodes.length >= 3);
    const ids = new Set();
    let year = 0;
    for (const n of f.nodes) {
      assert.ok(n.year >= year);
      year = n.year;
      assert.ok(!ids.has(n.id));
      ids.add(n.id);
      assert.ok(n.basis && n.change && n.look);
      assert.equal(new URL(n.source).protocol, 'https:');
      if (n.bikeId) {
        const bike = catalog.bikes.find((b) => b.id === n.bikeId);
        assert.ok(bike);
        assert.ok(bike.family.toLowerCase().includes(f.id));
      }
    }
  }
});
test('local API serves the same public rider story snapshot used by Pages', async (t) => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => new Promise((r) => server.close(r)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/rider-stories`);
  assert.equal(response.status, 200);
  assert.deepEqual(
    await response.json(),
    JSON.parse(readFileSync(new URL('../public/rider-stories.json', import.meta.url))),
  );
});
