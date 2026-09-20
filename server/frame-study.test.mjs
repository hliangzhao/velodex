import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const compile = (source) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`;
const surfaces = compile(
  read('../src/frameSurfaces.ts')
    .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
    .replace(
      "from 'three/addons/utils/BufferGeometryUtils.js'",
      `from '${import.meta.resolve('three/addons/utils/BufferGeometryUtils.js')}'`,
    ),
);
const code = compile(
  read('../src/buildFrameStudy.ts')
    .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
    .replace("from './frameSurfaces'", `from '${surfaces}'`)
    .replace(
      "import definitions from './data/frame-studies.json';",
      `const definitions=${read('../src/data/frame-studies.json')};`,
    ),
);
const { frameStudies, framePoints, buildFrameStudy } = await import(code);
const catalog = JSON.parse(read('./data/catalog.json'));
test('five frame categories use their stated sample geometry at a shared millimeter scale and bottom bracket origin', () => {
  assert.deepEqual(
    frameStudies.map((s) => s.id),
    ['aero', 'endurance', 'climbing', 'gravel', 'tt'],
  );
  for (const study of frameStudies) {
    const bike = catalog.bikes.find((b) => b.id === study.bikeId),
      g = bike.geometry.sizes.find((g) => g.size === study.geometry.size);
    for (const key of [
      'stack',
      'reach',
      'headTube',
      'chainstay',
      'wheelbase',
      'headAngle',
      'seatAngle',
      'bbDrop',
    ])
      assert.equal(study.geometry[key], g[key], `${study.id}/${key}`);
    const p = framePoints(study);
    assert.deepEqual(p.bb.toArray(), [0, 0, 0]);
    assert.equal(p.head.x, g.reach / 1000);
    assert.equal(p.head.y, g.stack / 1000);
    assert.ok(Math.abs((p.front.x - p.rear.x) * 1000 - g.wheelbase) < 1e-8);
    assert.ok(Math.abs(p.rear.distanceTo(p.bb) * 1000 - g.chainstay) < 1e-8);
    assert.ok(study.features.length >= 3);
    assert.ok(study.source.startsWith('https://'));
  }
});
test('frame surfaces, TT extensions and gravel mounts remain finite, visible and separately selectable', () => {
  for (const study of frameStudies)
    for (const ghost of [false, true]) {
      const model = buildFrameStudy(study, ghost);
      model.group.updateMatrixWorld(true);
      const parts = new Set(model.meshes.map((m) => m.userData.part));
      for (const part of ['tubes', 'rear', 'front']) assert.ok(parts.has(part));
      assert.equal(parts.has('cockpit'), study.id === 'tt');
      assert.equal(parts.has('mounts'), study.id === 'gravel');
      assert.equal(parts.has('clearance'), !ghost);
      for (const mesh of model.meshes) {
        for (const name of ['position', 'normal'])
          for (const value of mesh.geometry.getAttribute(name).array)
            assert.ok(Number.isFinite(value), `${study.id}/${name}`);
        const bounds = new THREE.Box3().setFromObject(mesh),
          size = bounds.getSize(new THREE.Vector3());
        assert.ok(size.x + size.y + size.z > 0.003, study.id);
        // A loft running along the Z axis must retain a section, not collapse into a line.
        if (study.id === 'tt' && mesh.userData.part === 'cockpit')
          assert.ok([size.x, size.y, size.z].filter((v) => v > 0.002).length >= 2);
      }
      model.dispose();
    }
});
