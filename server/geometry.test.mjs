import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { loadCatalog } from './app.mjs';

const profiles = readFileSync(new URL('../src/data/model-profiles.json', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/GeometryDiagram.tsx', import.meta.url), 'utf8').replace(
  "import profiles from './data/model-profiles.json';",
  `const profiles = ${profiles};`,
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
  },
});
const runnable = outputText.replace(
  /from (["'])(react(?:\/jsx-runtime)?)\1/g,
  (_, quote, name) => `from ${quote}${import.meta.resolve(name)}${quote}`,
);
const { default: GeometryDiagram } = await import(
  `data:text/javascript;base64,${Buffer.from(runnable).toString('base64')}`
);

test('2D geometry renders finite official dimensions even without a 3D model profile', () => {
  for (const bike of loadCatalog().bikes) {
    for (const g of bike.geometry.sizes) {
      const html = renderToStaticMarkup(createElement(GeometryDiagram, { g, bikeId: bike.id }));
      assert.doesNotMatch(html, /NaN|Infinity|undefined/, `${bike.id} ${g.size}`);
      assert.ok(html.includes(`STACK ${g.stack}`), bike.id);
      assert.ok(html.includes(`REACH ${g.reach}`), bike.id);
    }
  }
});
