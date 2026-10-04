import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sourcePath = new URL('../game/visuals.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
let assertions = 0;
const check = (value, message) => {
  assertions++;
  assert.ok(value, message);
};
const cases = [];

function fixture() {
  const events = [],
    changes = [],
    children = [];
  const state = { now: 0, hidden: false, focused: true, ratio: 1.5 };
  const document = {
    get hidden() {
      return state.hidden;
    },
    hasFocus: () => state.focused,
    createElement: () => ({
      dataset: {},
      textContent: '',
      title: '',
      className: '',
      setAttribute(k, v) {
        this[k] = v;
      },
      remove() {
        children.splice(children.indexOf(this), 1);
      },
    }),
  };
  const renderer = {
    getPixelRatio: () => state.ratio,
    setPixelRatio(value) {
      changes.push(value);
      state.ratio = value;
    },
    shadowMap: { enabled: true },
    info: { render: { calls: 72, triangles: 31000 } },
  };
  const root = { appendChild: (child) => children.push(child) };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: () => ({}),
    document,
    performance: { now: () => state.now },
    window: { dispatchEvent: (event) => events.push(event) },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
  });
  const meter = module.exports.performanceMeter(renderer, root, 'meter-test');
  const chip = children[0];
  const run = (seconds, interval, renderMs) => {
    const count = Math.ceil((seconds * 1000) / interval);
    for (let i = 0; i < count; i++) {
      state.now += interval;
      meter.frame(state.now, interval, renderMs);
    }
  };
  const unchanged = (label) => {
    check(
      state.ratio === 1.5 && changes.length === 0,
      `${label}: pixel ratio unchanged`,
    );
    check(renderer.shadowMap.enabled, `${label}: shadows retained`);
    check(events.length === 0, `${label}: no slow event`);
  };
  const result = (name) =>
    cases.push({
      name,
      status: 'PASS',
      pixelRatio: state.ratio,
      shadows: renderer.shadowMap.enabled,
      events: events.length,
      text: chip.textContent,
      fps: chip.dataset.fps ?? null,
      p95: chip.dataset.p95 ?? null,
    });
  return {
    state,
    events,
    changes,
    children,
    renderer,
    meter,
    chip,
    run,
    unchanged,
    result,
  };
}

{
  const f = fixture();
  f.run(18, 1000 / 60, 8);
  f.unchanged('60fps');
  check(f.chip.textContent === '60 FPS · Smooth', '60fps labeled Smooth');
  check(Number(f.chip.dataset.p95) === 17, '60fps p95 recorded');
  f.result('60fps full detail');
  f.meter.dispose();
  check(f.children.length === 0, 'dispose removes chip');
}
for (const fps of [10, 20]) {
  const f = fixture();
  f.run(12, 1000 / fps, fps === 10 ? 85 : 50);
  check(
    f.state.ratio < 1.5 && f.state.ratio >= 0.75,
    `${fps}fps reduces resolution within bound`,
  );
  check(!f.renderer.shadowMap.enabled, `${fps}fps disables shadows`);
  check(
    f.events.some(
      (e) =>
        e.type === 'sp-performance-slow' &&
        e.detail.fps === fps &&
        e.detail.label === 'meter-test',
    ),
    `${fps}fps warning event details`,
  );
  check(
    f.chip.textContent === `${fps} FPS · Adaptive detail`,
    `${fps}fps adaptive label`,
  );
  f.result(`${fps}fps expensive rendering`);
}
for (const mode of ['hidden', 'unfocused']) {
  const f = fixture();
  f.run(3.1, 1000 / 60, 8);
  f.state.hidden = mode === 'hidden';
  f.state.focused = mode !== 'unfocused';
  f.run(15, 100, 85);
  f.unchanged(mode);
  check(f.chip.textContent === 'Window inactive', `${mode}: inactive label`);
  check(
    f.chip.dataset.fps === undefined && f.chip.dataset.p95 === undefined,
    `${mode}: removes stale metrics`,
  );
  f.result(mode + ' frames excluded');
  f.state.hidden = false;
  f.state.focused = true;
  f.run(3.1, 1000 / 60, 8);
  f.unchanged(mode + ' recovery');
  check(
    f.chip.textContent === '60 FPS · Smooth',
    `${mode}: foreground metrics recover`,
  );
}
{
  const f = fixture();
  f.run(15, 1000, 12);
  f.unchanged('limited frame delivery');
  check(
    f.chip.textContent === '1 FPS · Frame delivery limited',
    'quick 1000ms frames labeled Frame delivery limited',
  );
  check(
    f.chip.title.includes(
      'Browser is supplying about one frame a second despite quick rendering',
    ),
    'limited delivery explanation',
  );
  check(
    f.chip.dataset.fps === '1' && f.chip.dataset.p95 === '1000',
    'limited delivery metrics',
  );
  f.result('active/focused 1000ms frames, 12ms render');
}
{
  const f = fixture();
  f.run(12, 1000, 60);
  check(
    f.state.ratio < 1.5 && !f.renderer.shadowMap.enabled && f.events.length > 0,
    '1000ms frames with expensive rendering still adapt',
  );
  check(
    f.chip.textContent === '1 FPS · Adaptive detail',
    'expensive rendering not mislabeled as frame limited',
  );
  f.result('active/focused 1000ms frames, 60ms render');
}
{
  const f = fixture();
  f.run(3.1, 100, 80);
  f.state.hidden = true;
  f.run(4, 1000, 80);
  f.state.hidden = false;
  f.run(3.1, 100, 80);
  f.unchanged('slow-window reset');
  check(
    f.chip.textContent === '10 FPS · Running slowly',
    'first new slow window does not inherit old streak',
  );
  f.result('inactive window resets slow streak');
}
const report = {
  status: 'PASS',
  source: fileURLToPath(sourcePath),
  assertions,
  cases,
};
console.log(
  `PASS: ${assertions} performance assertions across ${cases.length} cases.`,
);
