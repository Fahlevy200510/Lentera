import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(portalRoot, "node_modules", "typescript"));

const diagramPath = path.join(portalRoot, "components", "aruco", "CircuitDiagram.tsx");
const source = fs.readFileSync(diagramPath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  },
  fileName: diagramPath,
});

const mod = new Module(diagramPath);
mod.filename = diagramPath;
mod.paths = Module._nodeModulePaths(path.dirname(diagramPath));
mod._compile(outputText, diagramPath);

const { computeActiveCircuitCells, isSwitchClosedInLoop, getSwitchWireOrientation } = mod.exports;

// (a) Screenshot parallel layout: D3 switch OFF -> only inner branch (C2) lights up, outer branch (D3/E2) stays off
const screenshotParallel = {
  A2: { component: "battery", rotation: 0 },
  A3: { component: "l_cable", rotation: 90 },
  B3: { component: "straight_cable", rotation: 0 },
  C3: { component: "t_cable", rotation: 0 },
  C2: { component: "lamp", rotation: 90 },
  C1: { component: "t_cable", rotation: 180 },
  B1: { component: "straight_cable", rotation: 0 },
  A1: { component: "l_cable", rotation: 0 },
  D3: { component: "switch", rotation: 0, is_on: false },
  E3: { component: "l_cable", rotation: 180 },
  E2: { component: "lamp", rotation: 90 },
  E1: { component: "l_cable", rotation: 270 },
  D1: { component: "straight_cable", rotation: 0 },
};
assert.equal(getSwitchWireOrientation("D3", screenshotParallel), "horizontal");
assert.equal(isSwitchClosedInLoop("D3", screenshotParallel, "live"), false);
const activeScreenshotOff = computeActiveCircuitCells(screenshotParallel, "live");
assert.deepEqual(
  [...activeScreenshotOff].sort(),
  ["A1", "A2", "A3", "B1", "B3", "C1", "C2", "C3"]
);
assert.equal(activeScreenshotOff.has("E2"), false);
assert.equal(activeScreenshotOff.has("D3"), false);

const screenshotParallelOn = {
  ...screenshotParallel,
  D3: { component: "switch", rotation: 90, is_on: true },
};
assert.equal(isSwitchClosedInLoop("D3", screenshotParallelOn, "live"), true);
assert.equal(computeActiveCircuitCells(screenshotParallelOn, "live").size, 13);

// (b) SERIES_STEPS Step 12 (C5 & E4 OFF) -> no cell lit
const seriesBase = {
  B4: { component: "battery", rotation: 0 },
  B5: { component: "l_cable", rotation: 90 },
  C5: { component: "switch", rotation: 0, is_on: false },
  D5: { component: "lamp", rotation: 0 },
  E5: { component: "l_cable", rotation: 180 },
  E4: { component: "switch", rotation: 90, is_on: false },
  E3: { component: "lamp", rotation: 90 },
  E2: { component: "l_cable", rotation: 270 },
  D2: { component: "straight_cable", rotation: 0 },
  C2: { component: "straight_cable", rotation: 0 },
  B2: { component: "l_cable", rotation: 0 },
  B3: { component: "straight_cable", rotation: 90 },
};
assert.equal(computeActiveCircuitCells(seriesBase, "live").size, 0);

// Only C5 ON while E4 still OFF -> still open series circuit
assert.equal(
  computeActiveCircuitCells({ ...seriesBase, C5: { component: "switch", rotation: 90, is_on: true } }, "live").size,
  0
);

// (c) SERIES_STEPS Step 13 (C5 & E4 ON) -> all 12 cells lit
const seriesOn = {
  ...seriesBase,
  C5: { component: "switch", rotation: 90, is_on: true },
  E4: { component: "switch", rotation: 0, is_on: true },
};
assert.equal(computeActiveCircuitCells(seriesOn, "live").size, 12);

// (d) PARALLEL_STEPS: C4 ON, C3 OFF -> top branch (D4) lit, bottom branch (C3/D3) off
const parallelPartial = {
  B5: { component: "l_cable", rotation: 90 },
  C5: { component: "battery", rotation: 270 },
  D5: { component: "straight_cable", rotation: 0 },
  E5: { component: "l_cable", rotation: 180 },
  B4: { component: "t_cable", rotation: 270 },
  C4: { component: "switch", rotation: 90, is_on: true },
  D4: { component: "lamp", rotation: 0 },
  E4: { component: "t_cable", rotation: 90 },
  B3: { component: "l_cable", rotation: 0 },
  C3: { component: "switch", rotation: 0, is_on: false },
  D3: { component: "lamp", rotation: 0 },
  E3: { component: "l_cable", rotation: 270 },
};
const activeTopOnly = computeActiveCircuitCells(parallelPartial, "live");
assert.deepEqual(
  [...activeTopOnly].sort(),
  ["B4", "B5", "C4", "C5", "D4", "D5", "E4", "E5"]
);
assert.equal(activeTopOnly.has("D3"), false);
assert.equal(activeTopOnly.has("C3"), false);

// Variant presets ("series", "parallel", "closed", "open") match expectations
assert.equal(computeActiveCircuitCells({}, "live").size, 0);
assert.equal(computeActiveCircuitCells(parallelPartial, "open").size, 0);

// (e) Short circuit: load-free closed loop disables all glow
const shortCircuitParallel = {
  ...screenshotParallelOn,
  C2: { component: "straight_cable", rotation: 90 },
};
assert.equal(computeActiveCircuitCells(shortCircuitParallel, "live").size, 0);

// (f) Polarity reversed: single lamp reversed -> empty; parallel with one reversed -> only good branch lights
const reversedSeries = {
  ...seriesOn,
  D5: { component: "lamp", rotation: 180 },
};
assert.equal(computeActiveCircuitCells(reversedSeries, "live").size, 0);

const parallelOneReversed = {
  ...screenshotParallelOn,
  E2: { component: "lamp", rotation: 270 },
};
const activeOneGoodBranch = computeActiveCircuitCells(parallelOneReversed, "live");
assert.equal(activeOneGoodBranch.has("C2"), true);
assert.equal(activeOneGoodBranch.has("E2"), false);

// (g) AI Tutor route check: switch physical description uses saklar geser (not round/lingkaran), and long answers are trimmed
const tutorRoutePath = path.join(portalRoot, "app", "api", "tutor", "route.ts");
const tutorSource = fs.readFileSync(tutorRoutePath, "utf8");
assert.equal(/Saklar[\s\S]{0,60}lingkaran di tengah/i.test(tutorSource), false);
assert.equal(/SAKLAR GESER/i.test(tutorSource), true);
assert.equal(/function trimToConciseSentences/.test(tutorSource), true);

console.log("CircuitDiagram & AI Tutor self-check passed (7/7 scenario groups).");

