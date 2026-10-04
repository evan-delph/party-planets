import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { readPad } from '../game/gamepad';

// Simulate a connected controller against the actual navigation hook. The DOM
// fixture supplies layout/focus; no physical controller or user save is needed.
const clicked: string[] = [];
let frame: (time: number) => void = () => {};
let now = 0,
  startedCount = 0,
  backCount = 0,
  gameplay = false,
  dialog = false,
  overlay = false;
let buttons: number[] = [];
let connected = true;
class Element {
  attributes = new Map<string, string>();
  constructor(
    public name: string,
    public y: number,
    public primary = false,
    public hidden = false,
  ) {}
  classList = { contains: (c: string) => c === 'primary' && this.primary };
  getClientRects() {
    return [{}];
  }
  getBoundingClientRect() {
    return { x: 100, y: this.y, width: 200, height: 45 };
  }
  closest() {
    return this.hidden ? this : null;
  }
  matches() {
    return false;
  }
  focus() {
    document.activeElement = this;
  }
  click() {
    clicked.push(this.name);
  }
  setAttribute(k: string, v: string) {
    this.attributes.set(k, v);
  }
  removeAttribute(k: string) {
    this.attributes.delete(k);
  }
  scrollIntoView() {}
}
const settings = new Element('Settings', 10),
  buy = new Element('Buy', 100, true),
  hidden = new Element('Hidden switch input', 155, false, true),
  pass = new Element('Continue', 200);
const controls = [settings, buy, hidden, pass];
const panel = {
  querySelectorAll: () => [buy, hidden, pass],
  querySelector: () => pass,
};
const shell = {
  classList: { contains: () => gameplay },
  querySelector: (s: string) =>
    s === '.arena-overlay' ? (overlay ? panel : null) : dialog ? panel : null,
  querySelectorAll: () => controls,
};
const document = {
  activeElement: null as Element | null,
  hasFocus: () => true,
  querySelector: () => shell,
  querySelectorAll: (s: string) => (s.includes('listbox') ? [] : controls),
};
const options = {
  started: false,
  onStart: () => {
    startedCount++;
    options.started = true;
  },
  onBack: () => {
    backCount++;
  },
  context: 'menu',
};
const exported: { useGamepadUI?: (o: typeof options) => void } = {};
const compiled = ts.transpileModule(
  fs.readFileSync('game/useGamepadUI.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
vm.runInNewContext(compiled, {
  exports: exported,
  document,
  requestAnimationFrame: (fn: typeof frame) => {
    frame = fn;
    return 1;
  },
  cancelAnimationFrame: () => {},
  require: (name: string) =>
    name === 'react'
      ? {
          useRef: (current: unknown) => ({ current }),
          useState: () => [false, () => {}],
          useEffect: (fn: () => void) => fn(),
        }
      : {
          readPad,
          connectedGamepad: () =>
            connected
              ? {
                  connected: true,
                  axes: [0, 0],
                  buttons: Array.from({ length: 17 }, (_, i) => ({
                    pressed: buttons.includes(i),
                    touched: false,
                    value: buttons.includes(i) ? 1 : 0,
                  })),
                }
              : undefined,
        },
});
exported.useGamepadUI!(options);
function step(pressed: number[] = []) {
  buttons = pressed;
  now += 100;
  frame(now);
}
step([0]);
assert.equal(startedCount, 1);
step([0]);
assert.deepEqual(
  clicked,
  [],
  'Held start button does not confirm the next screen',
);
step();
assert.equal(document.activeElement, buy);
step([12]);
assert.equal(
  document.activeElement,
  settings,
  'Masthead controls are reachable',
);
step();
dialog = true;
options.context = 'diamond';
step();
assert.equal(document.activeElement, buy);
step([13, 0]);
assert.equal(document.activeElement, pass);
assert.deepEqual(
  clicked,
  ['Continue'],
  'Direction + confirm acts on the newly highlighted choice, skipping hidden inputs',
);
step([13, 0]);
assert.equal(clicked.length, 1, 'Holding A never confirms twice');
step();
step([1]);
assert.equal(backCount, 1);
gameplay = true;
dialog = false;
options.context = 'minigame';
step();
step([0]);
assert.equal(clicked.length, 1, 'Live gameplay never clicks menu controls');
overlay = true;
options.context = 'paused';
step();
step([0]);
assert.equal(clicked.at(-1), 'Buy', 'Pause overlay receives confirmation');
connected = false;
step();
connected = true;
step();
step([0]);
assert.equal(clicked.length, 3, 'Disconnect resets button edges');
console.log(
  'PASS: simulated controller start, held buttons, menu/header navigation, hidden inputs, diamond choice, live-game isolation and reconnect',
);
