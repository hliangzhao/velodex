import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/ride.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
);
const {
  defaultRideSettings: s,
  powerModel,
  analyzeRide,
  bestMeasuredWindow,
  validRideSettings,
  parseRideXML,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const ride = (points) => ({ format: 'TCX', points, discarded: 0 });

test('physics respects wind direction, system mass, drivetrain loss and zero downhill demand', () => {
  const p = powerModel(10, 0, 0, s);
  assert.ok(Math.abs(p.aero - 196) < 1e-9);
  assert.ok(Math.abs(p.watts - (196 + 79.5 * 9.80665 * 0.005 * 10) / 0.97) < 1e-9);
  assert.ok(powerModel(10, 0, 0, { ...s, wind: 2 }).watts > p.watts);
  assert.ok(powerModel(10, 0, 0, { ...s, wind: -2 }).watts < p.watts);
  assert.ok(powerModel(8, 0.06, 0, { ...s, cargo: 5 }).watts > powerModel(8, 0.06, 0, s).watts);
  assert.equal(powerModel(5, -0.12, 0, s).watts, 0);
  assert.ok(powerModel(10, 0, 0, { ...s, wind: -12 }).aero < 0);
  assert.ok(powerModel(10, 0, 1, s).watts > p.watts);
  assert.equal(validRideSettings({ ...s, cda: NaN }), false);
  assert.equal(validRideSettings({ ...s, rider: 0 }), false);
});
test('recorded mean includes coasting, weights time and does not fill missing watts', () => {
  const points = [
    { time: 0, power: 200 },
    { time: 1, power: 200 },
    { time: 10, power: 0 },
    { time: 20, power: 0 },
    { time: 25 },
    { time: 30, power: 500 },
  ].map((p) => ({ ...p, segment: 0 }));
  const a = analyzeRide(ride(points), s);
  assert.equal(a.measured.seconds, 20);
  assert.equal(a.measured.average, 55);
  assert.equal(a.measured.joules, 1100);
  assert.equal(a.estimated.average, undefined);
  assert.equal(a.duration, 30);
});
test('a steady flat route matches the physical model; missing elevation requires explicit flat assumption', () => {
  const points = Array.from({ length: 61 }, (_, i) => ({
    time: i * 5,
    segment: 0,
    distance: i * 50,
    elevation: 100,
  }));
  const r = analyzeRide(ride(points), s);
  assert.ok(Math.abs(r.estimated.average - powerModel(10, 0, 0, s).watts) < 1e-9);
  assert.equal(r.distance, 3000);
  assert.equal(r.climbing, 0);
  assert.equal(r.best20, undefined);
  const missing = ride(points.map(({ elevation, ...p }) => p));
  assert.equal(analyzeRide(missing, s).estimated.average, undefined);
  assert.ok(analyzeRide(missing, { ...s, flat: true }).estimated.average > 200);
});
test('long gaps and segment breaks never become travel, watts or a continuous twenty-minute effort', () => {
  const points = [0, 5, 10, 500, 505, 510].map((t) => ({
    time: t,
    segment: 0,
    distance: t * 10,
    power: 200,
    elevation: 0,
  }));
  const r = analyzeRide(ride(points), s);
  assert.equal(r.duration, 20);
  assert.equal(r.distance, 200);
  assert.equal(r.measured.average, 200);
  const rows = Array.from({ length: 240 }, (_, i) => ({
    start: i * 5,
    end: (i + 1) * 5,
    segment: i < 120 ? 0 : 1,
    measured: 200,
  }));
  assert.equal(bestMeasuredWindow(rows), undefined);
  assert.equal(bestMeasuredWindow(rows.map((r) => ({ ...r, segment: 0 }))), 200);
  rows[120].measured = undefined;
  assert.equal(bestMeasuredWindow(rows.map((r) => ({ ...r, segment: 0 }))), undefined);
});
test('best effort uses a true fixed-duration window with partial intervals', () => {
  const rows = [
    { start: 0, end: 30, segment: 0, measured: 100 },
    { start: 30, end: 40, segment: 0, measured: 400 },
    { start: 40, end: 90, segment: 0, measured: 100 },
  ];
  assert.equal(bestMeasuredWindow(rows, 40), 175);
  assert.equal(bestMeasuredWindow(rows, 10), 400);
});
test('bad GPS speed does not erase valid power-meter records', () => {
  const points = [
    { time: 0, distance: 0 },
    { time: 5, distance: 5000 },
    { time: 10, distance: 5050 },
  ].map((p) => ({ ...p, segment: 0, power: 200, elevation: 0 }));
  const r = analyzeRide(ride(points), s);
  assert.equal(r.skipped, 1);
  assert.equal(r.measured.average, 200);
  assert.equal(r.measured.seconds, 10);
  assert.equal(r.distance, 50);
});
test('oversized or entity-bearing XML is rejected before browser parsing', () => {
  assert.throws(
    () => parseRideXML('<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx/>'),
    /DTD/,
  );
  assert.throws(() => parseRideXML('x'.repeat(10 * 1024 * 1024 + 1)), /10 MB/);
});
