export type PadInput = {
  x: number;
  z: number;
  a: boolean;
  b: boolean;
  start: boolean;
  any: boolean;
};
export function readPad(
  pad: Pick<Gamepad, 'axes' | 'buttons'> | null | undefined,
): PadInput {
  const pressed = (n: number) => !!pad?.buttons[n]?.pressed;
  const axis = (n: number) => {
    const value = pad?.axes[n] ?? 0;
    return Math.abs(value) > 0.2
      ? (Math.sign(value) * (Math.abs(value) - 0.2)) / 0.8
      : 0;
  };
  return {
    x: pressed(15) ? 1 : pressed(14) ? -1 : axis(0),
    z: pressed(13) ? 1 : pressed(12) ? -1 : axis(1),
    a: pressed(0) || pressed(7),
    b: pressed(1) || pressed(5),
    start: pressed(9),
    any: pad?.buttons.some((b) => b.pressed) ?? false,
  };
}
export function connectedGamepad(): Gamepad | undefined {
  return (
    Array.from(navigator.getGamepads?.() ?? []).find((p) => !!p?.connected) ??
    undefined
  );
}
