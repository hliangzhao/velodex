import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadCatalog } from './app.mjs';

// Exercise actual mesh generation without a browser/WebGL context.
const path = new URL('../src/buildBikeModel.ts', import.meta.url);
let source = readFileSync(path, 'utf8')
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
