import * as T from 'three';

/** Small canvas-painted textures for Reef Ring Rally (no downloads). */
export function canvasTexture(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

const FONT = "'Fredoka Variable', 'Fredoka', 'Arial Rounded MT Bold', 'Arial Black', sans-serif";

/** A cumulus bank: puffy white tops, flat cool-shaded base. */
export function cloudTexture(seed: number) {
  return canvasTexture(512, 256, (ctx) => {
    let s = seed * 9.13 + 1;
    const r = () => {
      s = (s * 16807 + 11) % 2147483647;
      return (s % 10000) / 10000;
    };
    const puffs: [number, number, number][] = [];
    const n = 11 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1),
        x = 50 + u * 412 + (r() - 0.5) * 30,
        bulge = Math.sin(u * Math.PI),
        rad = 26 + bulge * (44 + r() * 30),
        y = 214 - rad * 0.75 - bulge * 34 * r();
      puffs.push([x, y, rad]);
    }
    // Silhouette.
    ctx.fillStyle = '#fff';
    for (const [x, y, rad] of puffs) {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.clearRect(0, 214, 512, 42);
    // Shade: bright tops, cool bellies.
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 40, 0, 214);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#f4faff');
    g.addColorStop(0.85, '#cfe2f4');
    g.addColorStop(1, '#a9c7e6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    for (const [x, y, rad] of puffs) {
      const lower = ctx.createRadialGradient(x, y + rad * 0.6, 0, x, y + rad * 0.6, rad);
      lower.addColorStop(0, 'rgba(150,185,220,0.35)');
      lower.addColorStop(1, 'rgba(150,185,220,0)');
      ctx.fillStyle = lower;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2.2);
      const hi = ctx.createRadialGradient(
        x - rad * 0.25,
        y - rad * 0.45,
        0,
        x - rad * 0.25,
        y - rad * 0.45,
        rad * 0.85,
      );
      hi.addColorStop(0, 'rgba(255,255,255,0.95)');
      hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi;
      ctx.fillRect(x - rad * 1.2, y - rad * 1.4, rad * 2.2, rad * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  });
}

export function glowTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Four-point twinkle. */
export function sparkleTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#fff';
    for (const [w, h] of [
      [9, 62],
      [62, 9],
    ]) {
      ctx.beginPath();
      ctx.moveTo(64, 64 - h);
      ctx.quadraticCurveTo(64, 64, 64 + w, 64);
      ctx.quadraticCurveTo(64, 64, 64, 64 + h);
      ctx.quadraticCurveTo(64, 64, 64 - w, 64);
      ctx.quadraticCurveTo(64, 64, 64, 64 - h);
      ctx.fill();
    }
  });
}

/** Chunky player badge: coloured coin with an outlined "P1". */
export function badgeTexture(text: string, color: string) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.beginPath();
    ctx.arc(64, 60, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#10213a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 56, 46, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    const shine = ctx.createLinearGradient(0, 14, 0, 70);
    shine.addColorStop(0, 'rgba(255,255,255,0.55)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.ellipse(64, 36, 34, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();
    ctx.font = `800 44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#10213a';
    ctx.strokeText(text, 64, 60);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 64, 60);
    // Pointer tail.
    ctx.beginPath();
    ctx.moveTo(52, 104);
    ctx.lineTo(76, 104);
    ctx.lineTo(64, 122);
    ctx.closePath();
    ctx.fillStyle = '#10213a';
    ctx.fill();
  });
}

/** "+1" / "+3" score pop. */
export function popTexture(text: string, color: string) {
  return canvasTexture(256, 128, (ctx) => {
    ctx.font = `800 92px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#10213a';
    ctx.strokeText(text, 128, 66);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 66);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.strokeText(text, 128, 62);
  });
}
