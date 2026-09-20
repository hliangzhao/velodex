import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadCatalog } from './app.mjs';

// Exercise actual mesh generation without a browser/WebGL context.
const surfaceCode = ts.transpileModule(
  readFileSync(new URL('../src/frameSurfaces.ts', import.meta.url), 'utf8')
    .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
    .replace(
      "from 'three/addons/utils/BufferGeometryUtils.js'",
      `from '${import.meta.resolve('three/addons/utils/BufferGeometryUtils.js')}'`,
    ),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const surfaceURL = `data:text/javascript;base64,${Buffer.from(surfaceCode).toString('base64')}`;
const path = new URL('../src/buildBikeModel.ts', import.meta.url);
let source = readFileSync(path, 'utf8')
  .replace("from './frameSurfaces'", `from '${surfaceURL}'`)
  .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
  .replace(
    "from 'three/addons/utils/BufferGeometryUtils.js'",
    `from '${import.meta.resolve('three/addons/utils/BufferGeometryUtils.js')}'`,
  )
  .replace(
    "import profiles from './data/model-profiles.json';",
    `const profiles = ${readFileSync(new URL('../src/data/model-profiles.json', import.meta.url), 'utf8')};`,
  );
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { buildBikeModel } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('every model and frame-size extreme generates finite, raycastable geometry', () => {
  for (const bike of loadCatalog().bikes) {
    const sizes = bike.geometry.sizes;
    for (const g of new Set([
      sizes[0],
      sizes.find((g) => g.size === bike.geometry.defaultSize),
      sizes.at(-1),
    ])) {
      const { meshes, group, feature } = buildBikeModel(bike, g);
      assert.ok(feature && meshes.length > 50, bike.id);
      const parts = new Set(meshes.map((m) => m.userData.part));
      const structures = new Set(meshes.map((m) => m.userData.structure));
      assert.equal(structures.has('tt-extension'), bike.kind === 'TT 计时', bike.id);
      assert.equal(structures.has('tt-elbow-pad'), bike.kind === 'TT 计时', bike.id);
      assert.equal(structures.has('rear-disc'), bike.id === 'speedmax-cfr-tt', bike.id);
      const singleRing = ['sunpeed-universe', 'diverge-comp-carbon'].includes(bike.id);
      assert.equal(structures.has('inner-chainring'), !singleRing, `${bike.id}/chainring-count`);
      assert.equal(structures.has('front-derailleur'), !singleRing, `${bike.id}/front-derailleur`);
      assert.equal(structures.has('gravel-tread'), bike.kind === '砾石公路', bike.id);
      assert.equal(structures.has('future-shock'), bike.id === 'diverge-comp-carbon', bike.id);
      if (bike.kind === '砾石公路') assert.ok(structures.has('fork-mount'), bike.id);
      const cassetteSpeeds = {
        'sworks-venge': 11,
        'sunpeed-universe': 11,
        'diverge-comp-carbon': 12,
      };
      if (bike.id in cassetteSpeeds)
        assert.equal(
          meshes.filter((m) => m.userData.structure === 'cassette-sprocket').length,
          cassetteSpeeds[bike.id],
          `${bike.id}/cassette-speeds`,
        );

      assert.equal(parts.has('power'), bike.hasPowerMeter, `${bike.id}/power-meter equipment`);
      for (const id of ['frame', 'shifters', 'crank', 'chainrings', 'cassette', 'wheels', 'tires'])
        assert.ok(parts.has(id), `${bike.id}/${id}`);
      for (const m of meshes) {
        for (const name of ['position', 'normal']) {
          const values = m.geometry.getAttribute(name).array;
          for (const value of values)
            assert.ok(Number.isFinite(value), `${bike.id}/${g.size}/${name}`);
        }
        m.geometry.dispose();
      }
      new Set(meshes.map((m) => m.material)).forEach((m) => m.dispose());
      group.clear();
    }
  }
});
