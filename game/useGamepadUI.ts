'use client';
import { useEffect, useRef, useState } from 'react';
import { connectedGamepad, readPad } from './gamepad';

const selector =
  'button, input, [role="combobox"], [role="slider"], [role="switch"], [role="radio"], [role="tab"]';
const visible = (el: HTMLElement) =>
  el.getClientRects().length > 0 &&
  !el.closest('[aria-hidden="true"]') &&
  !el.matches(':disabled,[aria-disabled="true"],[data-disabled]');
function key(el: Element, value: string) {
  el.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: value,
      code: value,
      bubbles: true,
      cancelable: true,
    }),
  );
  el.dispatchEvent(
    new KeyboardEvent('keyup', { key: value, code: value, bubbles: true }),
  );
}

/** Menu navigation only. The arena owns live gameplay inputs. */
export function useGamepadUI(options: {
  started: boolean;
  onStart: () => void;
  onBack: () => void;
  context: string;
}) {
  const latest = useRef(options);
  latest.current = options;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let raf = 0,
      wasAny = false,
      wasA = false,
      wasB = false,
      nextMove = 0,
      lastDirection = '',
      wasConnected = false,
      lastContext = '';
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const pad = connectedGamepad(),
        input = readPad(pad);
      if (!!pad !== wasConnected) {
        wasConnected = !!pad;
        setConnected(!!pad);
      }
      const a = input.a && !wasA,
        b = input.b && !wasB,
        any = input.any && !wasAny;
      wasA = input.a;
      wasB = input.b;
      wasAny = input.any;
      if (!pad || !document.hasFocus()) return;
      const p = latest.current;
      if (!p.started) {
        if (any) p.onStart();
        return;
      }
      const shell = document.querySelector<HTMLElement>('.game-shell');
      if (!shell) return;
      const overlay = shell.querySelector<HTMLElement>('.arena-overlay');
      if (shell.classList.contains('minigame-mode') && !overlay) return;
      const popup = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="listbox"], [role="menu"]',
        ),
      ).find(visible);
      const scope =
        popup ??
        overlay ??
        shell.querySelector<HTMLElement>(
          '.diamond-panel, .fork-panel, .center-panel, .side-panel',
        ) ??
        shell;
      const controls = Array.from(
        scope.querySelectorAll<HTMLElement>(
          popup ? '[role="option"], [role="menuitem"]' : selector,
        ),
      ).filter(visible);
      const context =
        p.context + (overlay ? '-overlay' : '') + (popup ? '-popup' : '');
      const changedContext = context !== lastContext;
      if (changedContext) {
        lastContext = context;
        shell
          .querySelectorAll('[data-pad-focus]')
          .forEach((el) => el.removeAttribute('data-pad-focus'));
      }
      const direction =
        Math.abs(input.z) > 0.5
          ? input.z > 0
            ? 'ArrowDown'
            : 'ArrowUp'
          : Math.abs(input.x) > 0.5
            ? input.x > 0
              ? 'ArrowRight'
              : 'ArrowLeft'
            : '';
      const move =
        direction && (direction !== lastDirection || now >= nextMove);
      let active = document.activeElement as HTMLElement | null;
      const focus = (el?: HTMLElement) => {
        if (!el) return;
        document
          .querySelectorAll('[data-pad-focus]')
          .forEach((n) => n.removeAttribute('data-pad-focus'));
        el.setAttribute('data-pad-focus', 'true');
        el.focus({ preventScroll: true });
        active = document.activeElement as HTMLElement | null;
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      };
      if (changedContext && !popup)
        focus(
          controls.find((el) => el.classList.contains('primary')) ??
            controls[0],
        );
      if (move) {
        nextMove = now + (direction !== lastDirection ? 380 : 160);
        if (popup) key(active ?? popup, direction);
        else if (
          active?.matches('[role="slider"], input[type="range"]') &&
          /Left|Right/.test(direction)
        )
          key(active, direction);
        else {
          const index = controls.indexOf(active!);
          if (index < 0) focus(controls[0]);
          else {
            const rect = active!.getBoundingClientRect(),
              cx = rect.x + rect.width / 2,
              cy = rect.y + rect.height / 2;
            const vertical = /Up|Down/.test(direction),
              sign = /Down|Right/.test(direction) ? 1 : -1;
            const candidates = controls
              .filter((el) => el !== active)
              .map((el) => {
                const r = el.getBoundingClientRect(),
                  dx = r.x + r.width / 2 - cx,
                  dy = r.y + r.height / 2 - cy;
                const along = (vertical ? dy : dx) * sign,
                  across = Math.abs(vertical ? dx : dy);
                return { el, along, score: along + across * 3 };
              })
              .filter((c) => c.along > 8)
              .sort((a, b) => a.score - b.score);
            focus(
              candidates[0]?.el ??
                controls[(index + sign + controls.length) % controls.length],
            );
          }
        }
      }
      lastDirection = direction;
      if (a) {
        active = document.activeElement as HTMLElement | null;
        if (popup) key(active ?? popup, 'Enter');
        else if (active && controls.includes(active)) active.click();
        else
          focus(
            controls.find((el) => el.classList.contains('primary')) ??
              controls[0],
          );
      }
      if (b) {
        if (popup) key(active ?? popup, 'Escape');
        else if (overlay)
          overlay.querySelector<HTMLButtonElement>('.text-button')?.click();
        else p.onBack();
      }
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return connected;
}
