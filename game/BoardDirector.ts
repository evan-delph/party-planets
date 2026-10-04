import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SPACE_INFO, type Space } from './config';
import type { BoardEvent, Game } from './engine';

/**
 * Board "juice" layered on top of BoardScene's avatar placement: the dice block
 * players jump into, the floating step counter, score pop-ups, coin bursts,
 * landing ripples, stomps and size changes. Everything is driven from the
 * authoritative game timestamps, so online and solo play look the same.
 */
type Frame = {
  game?: Game;
  serverNow: number;
  dt: number;
  meshes: T.Group[];
  reduced: boolean;
  camera: T.Camera;
};
const sound = (kind: string, delta = 0) =>
  window.dispatchEvent(
    new CustomEvent('sp-sound', { detail: { kind, delta } }),
  );
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
/** World-space top of an avatar's head (avatars are ~2.2 units tall at scale 0.72). */
const headY = (m: T.Object3D) => m.position.y + 2.15 * (m.scale.y / 0.72);
const COUNTING = ['moving', 'fork', 'diamond', 'steal', 'lottery'];

function canvasTexture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return { canvas, ctx: canvas.getContext('2d')!, texture };
}
function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

export function createBoardDirector(world: T.Object3D, nodes: Space[]) {
  const root = new T.Group();
  world.add(root);
  const disposables: { dispose(): void }[] = [];

  // ── Dice blocks ────────────────────────────────────────────────────────────
  // Numbered sides, a plain star badge on top and bottom (box groups: ±x, ±y, ±z).
  const cap = canvasTexture(128, 128);
  {
    const c = cap.ctx,
      g = c.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, '#e9fbff');
    g.addColorStop(1, '#7fd8ff');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#2a6fd8';
    c.lineWidth = 10;
    roundRect(c, 6, 6, 116, 116, 22);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 17 : 38,
        a = (i * Math.PI) / 5 - Math.PI / 2;
      c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    c.fill();
  }
  const capMaterial = new T.MeshStandardMaterial({
    map: cap.texture,
    roughness: 0.25,
    emissive: '#2a5bd8',
    emissiveIntensity: 0.2,
  });
  disposables.push(cap.texture, capMaterial);
  const dice = [0, 1].map(() => {
    const face = canvasTexture(128, 128);
    const material = new T.MeshStandardMaterial({
      map: face.texture,
      roughness: 0.25,
      metalness: 0.05,
      emissive: '#2a5bd8',
      emissiveIntensity: 0.25,
    });
    const mesh = new T.Mesh(new RoundedBoxGeometry(1.15, 1.15, 1.15, 4, 0.18), [
      material,
      material,
      capMaterial,
      capMaterial,
      material,
      material,
    ]);
    mesh.castShadow = true;
    mesh.visible = false;
    root.add(mesh);
    disposables.push(face.texture, material, mesh.geometry);
    return { mesh, face, shown: -1 };
  });
  function drawDie(d: (typeof dice)[number], value: number, hit: boolean) {
    const key = value * 2 + (hit ? 1 : 0);
    if (d.shown === key) return;
    d.shown = key;
    const c = d.face.ctx;
    const g = c.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, hit ? '#fff6c9' : '#e9fbff');
    g.addColorStop(1, hit ? '#ffc93d' : '#7fd8ff');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = hit ? '#e08a00' : '#2a6fd8';
    c.lineWidth = 10;
    roundRect(c, 6, 6, 116, 116, 22);
    c.stroke();
    c.font = '900 76px "Trebuchet MS", Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 9;
    c.strokeStyle = '#fff';
    c.strokeText(String(value), 64, 70);
    c.fillStyle = hit ? '#b24a00' : '#163a7a';
    c.fillText(String(value), 64, 70);
    d.face.texture.needsUpdate = true;
  }

  // ── Floating step counter ─────────────────────────────────────────────────
  const counterTex = canvasTexture(128, 128);
  const counter = new T.Sprite(
    new T.SpriteMaterial({ map: counterTex.texture, depthTest: false, fog: false }),
  );
  counter.renderOrder = 20;
  counter.visible = false;
  root.add(counter);
  disposables.push(counterTex.texture, counter.material);
  let counterValue = -1,
    counterPop = 0;
  function drawCounter(n: number, mini: boolean) {
    const c = counterTex.ctx;
    c.clearRect(0, 0, 128, 128);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 10;
    c.strokeStyle = mini ? '#b06cff' : '#23a3ee';
    c.stroke();
    c.fillStyle = '#123050';
    c.font = `900 ${n > 9 ? 62 : 74}px "Trebuchet MS", Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(n), 64, 69);
    counterTex.texture.needsUpdate = true;
  }

  // ── Pop-up text ──────────────────────────────────────────────────────────
  type Popup = {
    sprite: T.Sprite;
    tex: ReturnType<typeof canvasTexture>;
    born: number;
    life: number;
    from: T.Vector3;
    big: boolean;
  };
  const popups: Popup[] = Array.from({ length: 14 }, () => {
    const tex = canvasTexture(320, 128);
    const sprite = new T.Sprite(
      new T.SpriteMaterial({ map: tex.texture, depthTest: false, fog: false, transparent: true }),
    );
    sprite.renderOrder = 21;
    sprite.visible = false;
    root.add(sprite);
    disposables.push(tex.texture, sprite.material);
    return { sprite, tex, born: -1e9, life: 1, from: new T.Vector3(), big: false };
  });
  function popup(text: string, color: string, at: T.Vector3, now: number, big = false) {
    const p = popups.reduce((a, b) => (a.born < b.born ? a : b));
    const c = p.tex.ctx;
    c.clearRect(0, 0, 320, 128);
    c.font = `900 ${big ? 76 : 70}px "Trebuchet MS", Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 16;
    c.strokeStyle = '#13233b';
    c.strokeText(text, 160, 66);
    c.fillStyle = color;
    c.fillText(text, 160, 66);
    p.tex.texture.needsUpdate = true;
    p.born = now;
    p.life = big ? 1.9 : 1.5;
    p.big = big;
    p.from.copy(at);
    p.sprite.visible = true;
  }
  const pointsPopup = (delta: number, at: T.Vector3, now: number) =>
    popup(delta > 0 ? `+${delta}` : `−${-delta}`, delta > 0 ? '#ffd23f' : '#ff6464', at, now);

  // ── Coins ────────────────────────────────────────────────────────────────
  const coinGeo = new T.CylinderGeometry(0.2, 0.2, 0.06, 16);
  const coinMat = new T.MeshStandardMaterial({
    color: '#ffc63a',
    emissive: '#b47600',
    emissiveIntensity: 0.4,
    metalness: 0.6,
    roughness: 0.3,
  });
  disposables.push(coinGeo, coinMat);
  type Coin = { mesh: T.Mesh; born: number; from: T.Vector3; to: T.Vector3; spin: number };
  const coins: Coin[] = Array.from({ length: 36 }, () => {
    const mesh = new T.Mesh(coinGeo, coinMat);
    mesh.visible = false;
    root.add(mesh);
    return { mesh, born: -1e9, from: new T.Vector3(), to: new T.Vector3(), spin: 0 };
  });
  const COIN_LIFE = 0.75;
  function coinBurst(from: T.Vector3, to: T.Vector3, count: number, now: number) {
    for (let i = 0; i < Math.min(count, 10); i++) {
      const c = coins.reduce((a, b) => (a.born < b.born ? a : b));
      c.born = now + i * 0.06;
      c.from.copy(from);
      c.to.copy(to).add(new T.Vector3(Math.sin(i * 2.4) * 0.5, 0, Math.cos(i * 2.4) * 0.5));
      c.spin = 6 + i;
    }
  }

  // ── Landing ripples and sparks ───────────────────────────────────────────
  const ringGeo = new T.RingGeometry(0.75, 0.95, 40);
  disposables.push(ringGeo);
  const rings = Array.from({ length: 4 }, () => {
    const material = new T.MeshBasicMaterial({
      color: '#fff',
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    });
    const mesh = new T.Mesh(ringGeo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    root.add(mesh);
    disposables.push(material);
    return { mesh, born: -1e9 };
  });
  function ripple(space: Space, color: string, now: number) {
    const r = rings.reduce((a, b) => (a.born < b.born ? a : b));
    r.born = now;
    r.mesh.position.set(space.x, 0.95, space.z);
    (r.mesh.material as T.MeshBasicMaterial).color.set(color);
  }
  const sparkGeo = new T.OctahedronGeometry(0.12);
  disposables.push(sparkGeo);
  const sparks = Array.from({ length: 24 }, (_, i) => {
    const material = new T.MeshBasicMaterial({ color: '#ffe066', transparent: true });
    const mesh = new T.Mesh(sparkGeo, material);
    mesh.visible = false;
    root.add(mesh);
    disposables.push(material);
    return { mesh, born: -1e9, origin: new T.Vector3(), dir: new T.Vector3(Math.sin(i * 2.4), 0.6 + (i % 5) * 0.25, Math.cos(i * 2.4)) };
  });
  function sparkBurst(at: T.Vector3, color: string, now: number) {
    sparks.forEach((s, i) => {
      s.born = now + (i % 3) * 0.02;
      s.origin.copy(at);
      (s.mesh.material as T.MeshBasicMaterial).color.set(color);
    });
  }

  // ── Per-player body language (squash, size) ──────────────────────────────
  const squashUntil = new Map<string, number>();

  // ── Bookkeeping so reloads never replay old moments ──────────────────────
  let clock = 0,
    seenEffect: number | undefined,
    seenEvent: number | undefined,
    rollKey = -1,
    hitKey = -1;
  const tmp = new T.Vector3(),
    right = new T.Vector3();

  function onEffect(game: Game, meshes: T.Group[], fresh: boolean) {
    const e = game.effect!;
    const space = nodes[e.space] ?? nodes[0];
    const info = SPACE_INFO[e.kind as keyof typeof SPACE_INFO];
    ripple(space, info?.color ?? (e.kind === 'steal' ? '#c68cef' : '#ffd23f'), clock);
    if (!fresh || e.kind === 'steal' || e.kind === 'lottery') return;
    const meshOf = (id: string) => meshes[game.players.findIndex((p) => p.id === id)];
    if (e.kind === 'diamond') {
      const m = meshOf(e.player);
      if (m) popup('+1 ◆', '#7cf3ff', tmp.set(m.position.x, headY(m), m.position.z), clock, true);
      return;
    }
    if (e.kind === 'villain') {
      const m = meshOf(e.player);
      if (m) popup('☠', '#c9a2ff', tmp.set(m.position.x, headY(m) + 0.6, m.position.z), clock, true);
    }
    const changes = e.losses?.length
      ? e.losses
      : [{ player: e.player, delta: e.delta, space: e.space }];
    for (const c of changes) {
      const m = meshOf(c.player);
      if (!m || !c.delta) continue;
      const head = new T.Vector3(m.position.x, headY(m), m.position.z);
      pointsPopup(c.delta, head, clock);
      const tile = nodes[game.players.find((p) => p.id === c.player)!.pos] ?? space;
      const ground = new T.Vector3(tile.x, 1, tile.z);
      if (c.delta > 0) coinBurst(ground, head.clone().setY(head.y - 0.8), Math.ceil(c.delta / 3), clock);
      else coinBurst(head.clone().setY(head.y - 0.8), ground.setY(0.2), Math.ceil(-c.delta / 3), clock);
    }
  }
  function onEvent(game: Game, ev: BoardEvent, meshes: T.Group[]) {
    const meshOf = (id?: string) =>
      id === undefined ? undefined : meshes[game.players.findIndex((p) => p.id === id)];
    const actor = meshOf(ev.player),
      target = meshOf(ev.target);
    const above = (m: T.Object3D, lift = 0) => new T.Vector3(m.position.x, headY(m) + lift, m.position.z);
    if (ev.kind === 'stomp' && target) {
      squashUntil.set(ev.target!, clock + 1.4);
      popup('STOMP!', '#ffffff', above(target, 0.9), clock, true);
      if (ev.delta) pointsPopup(-ev.delta, above(target), clock);
      if (actor) coinBurst(above(target, -0.6), above(actor, -0.6), Math.ceil(ev.delta / 2), clock);
      sound('stomp');
    } else if (ev.kind === 'steal' && actor && target) {
      if (ev.delta === 1 && /diamond/.test(ev.text)) {
        popup('−1 ◆', '#ff6464', above(target), clock);
        popup('+1 ◆', '#7cf3ff', above(actor, 0.4), clock, true);
      } else {
        pointsPopup(-ev.delta, above(target), clock);
        pointsPopup(ev.delta, above(actor, 0.4), clock);
        coinBurst(above(target, -0.6), above(actor, -0.6), Math.ceil(ev.delta / 2), clock);
      }
      sound('steal');
    } else if (ev.kind === 'size' && actor) {
      const grow = /GIGANTIC/.test(ev.text);
      popup(grow ? 'GROW!' : 'SHRINK!', grow ? '#ff9b3d' : '#c08bff', above(actor, 0.5), clock, true);
      sparkBurst(above(actor, -1), grow ? '#ffb347' : '#c08bff', clock);
      sound(grow ? 'grow' : 'shrink');
    } else if (ev.kind === 'bank' && actor) {
      // Coins hop from the walker into the bank tile.
      const tile = nodes[ev.space] ?? nodes[0];
      popup(`−${ev.delta} BANK`, '#ffd23f', above(actor), clock);
      coinBurst(above(actor, -0.6), new T.Vector3(tile.x, 1, tile.z), ev.delta, clock);
      ripple(tile, '#ffd23f', clock);
      sound('count', 3);
    } else if (ev.kind === 'lap' && actor) {
      popup(`+${ev.delta} LAP`, '#7dffb2', above(actor, 0.3), clock);
      coinBurst(new T.Vector3(actor.position.x, 1, actor.position.z), above(actor, -0.6), 4, clock);
      sound('spring');
    } else if (ev.kind === 'lastTurns' && actor) {
      popup('BOOST!', '#7dffb2', above(actor, 0.5), clock, true);
      sparkBurst(above(actor, -1), '#7dffb2', clock);
    }
  }

  function frame({ game, serverNow, dt, meshes, reduced, camera }: Frame) {
    clock += dt;
    root.visible = !!game;
    if (!game) return;
    const active = game.players[game.active],
      mesh = meshes[game.active];

    // Moments that arrived since the last frame (fresh ones only animate).
    if (seenEffect === undefined) seenEffect = game.effect?.id ?? -1;
    if (game.effect && game.effect.id !== seenEffect) {
      seenEffect = game.effect.id;
      const fresh = game.effect.startedAt === undefined || serverNow - game.effect.startedAt < 3000;
      onEffect(game, meshes, fresh);
    }
    const lastId = game.events?.at(-1)?.id ?? 0;
    if (seenEvent === undefined) seenEvent = lastId;
    if (lastId > seenEvent) {
      for (const ev of game.events!)
        if (ev.id > seenEvent && serverNow - ev.at < 4000) onEvent(game, ev, meshes);
      seenEvent = lastId;
    }

    // Size, squash and the dice-hit jump adjust BoardScene's base placement.
    game.players.forEach((p, i) => {
      const m = meshes[i];
      if (!m) return;
      const goal = p.size === 'mega' ? 1.9 : p.size === 'mini' ? 0.55 : 1;
      m.userData.size = T.MathUtils.lerp(m.userData.size ?? 1, goal, reduced ? 1 : 1 - Math.exp(-dt * 7));
      m.scale.multiplyScalar(m.userData.size);
      const until = squashUntil.get(p.id) ?? 0;
      if (clock < until) {
        const t = clamp01((until - clock) / 1.4);
        const flat = reduced ? 0.5 : Math.min(1, t * 3) * 0.7;
        m.scale.y *= 1 - flat;
        m.scale.x *= 1 + flat * 0.5;
        m.scale.z *= 1 + flat * 0.5;
      }
    });

    // ── Dice block ────────────────────────────────────────────────────────
    // Aliens still aboard the UFO hit their block after stepping off the ramp.
    const leftAt = game.departed?.[active.id],
      outside =
        (!game.flight || leftAt !== undefined) &&
        (leftAt === undefined || serverNow >= leftAt + 1200);
    const rolling = game.phase === 'rolling' && !!game.dice && outside,
      awaiting =
        game.phase === 'turn' &&
        outside &&
        serverNow >= (game.announce?.until ?? 0) - 600;
    const count = rolling ? game.dice!.values.length : active.double || active.size === 'mega' ? 2 : 1;
    const sides = active.size === 'mini' ? 5 : 10;
    const revealAt = rolling ? game.dice!.revealAt : Infinity;
    const hit = clamp01((serverNow - revealAt) / 420);
    if (rolling && rollKey !== game.dice!.startedAt && serverNow >= game.dice!.startedAt) {
      rollKey = game.dice!.startedAt;
      if (serverNow - rollKey < 800) sound('diceRoll');
    }
    if (mesh && rolling && !reduced) {
      // Jump up into the block, peaking at the reveal.
      const j = clamp01((serverNow - (revealAt - 360)) / 640);
      if (j > 0 && j < 1) mesh.position.y += Math.sin(j * Math.PI) * 1.35;
    }
    if (rolling && hitKey !== game.dice!.startedAt && serverNow >= revealAt) {
      hitKey = game.dice!.startedAt;
      if (serverNow - revealAt < 900 && mesh) {
        sound('diceHit');
        sparkBurst(tmp.set(mesh.position.x, headY(mesh) + 1.1, mesh.position.z), '#ffd23f', clock);
      }
    }
    right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    dice.forEach((d, i) => {
      const show = !!mesh && i < count && (awaiting || (rolling && hit < 1));
      d.mesh.visible = show;
      if (!show) return;
      const final = rolling && serverNow >= revealAt;
      const value = final
        ? game.dice!.values[i]
        : 1 + (Math.floor(serverNow / (rolling ? 70 : 110) + i * 3) % sides);
      drawDie(d, value, final);
      const spread = (i - (count - 1) / 2) * 1.45;
      d.mesh.position
        .set(mesh.position.x, 0, mesh.position.z)
        .addScaledVector(right, spread)
        .setY(headY(mesh) - (rolling && !reduced ? Math.sin(clamp01((serverNow - (revealAt - 360)) / 640) * Math.PI) * 1.35 : 0) + 1.55 + (reduced ? 0 : Math.sin(clock * 3 + i) * 0.12));
      // Spin about the vertical axis; settle with the numbered face to the camera.
      const facing = Math.atan2(
        camera.position.x - d.mesh.position.x,
        camera.position.z - d.mesh.position.z,
      );
      const spin = reduced || final ? 0 : clock * (rolling ? 9 : 2.2) + i;
      d.mesh.rotation.set(0, facing + spin, 0);
      const pop = final ? (hit < 0.5 ? 1 + Math.sin(hit * 2 * Math.PI) * 0.35 : 1 - (hit - 0.5) * 2) : 1;
      d.mesh.scale.setScalar(Math.max(0.001, pop * (active.size === 'mini' ? 0.8 : 1)));
    });

    // ── Step counter ──────────────────────────────────────────────────────
    const remaining = game.remaining ?? 0;
    const showCounter =
      !!mesh &&
      remaining > 0 &&
      (COUNTING.includes(game.phase) || (rolling && serverNow >= revealAt + 180));
    counter.visible = showCounter;
    if (showCounter) {
      if (remaining !== counterValue) {
        if (counterValue > remaining && game.phase === 'moving') sound('count', remaining);
        counterValue = remaining;
        counterPop = 1;
        drawCounter(remaining, active.size === 'mini');
      }
      counterPop = Math.max(0, counterPop - dt * 4);
      const base = 1.25 * (1 + (reduced ? 0 : counterPop * 0.35));
      counter.scale.setScalar(base);
      counter.position.set(mesh.position.x, headY(mesh) + 1.05, mesh.position.z);
    } else counterValue = -1;

    // ── Pop-ups, coins, ripples, sparks ──────────────────────────────────
    for (const p of popups) {
      const age = (clock - p.born) / p.life;
      p.sprite.visible = age >= 0 && age < 1;
      if (!p.sprite.visible) continue;
      const rise = reduced ? 0.6 : easeOutBack(clamp01(age * 3)) * 0.9 + age * 0.9;
      p.sprite.position.copy(p.from).setY(p.from.y + rise);
      const s = (p.big ? 2.2 : 1.7) * (reduced ? 1 : Math.min(1, age * 6) * (1 + Math.max(0, 0.25 - age) * 0.8));
      p.sprite.scale.set(s * 2.5, s, 1);
      (p.sprite.material as T.SpriteMaterial).opacity = 1 - clamp01((age - 0.7) / 0.3);
    }
    for (const c of coins) {
      const t = (clock - c.born) / COIN_LIFE;
      c.mesh.visible = !reduced && t >= 0 && t < 1;
      if (!c.mesh.visible) continue;
      c.mesh.position.lerpVectors(c.from, c.to, t);
      c.mesh.position.y += Math.sin(t * Math.PI) * 1.6;
      c.mesh.rotation.set(Math.PI / 2, 0, clock * c.spin);
      c.mesh.scale.setScalar(t > 0.85 ? (1 - t) / 0.15 : 1);
    }
    for (const r of rings) {
      const t = (clock - r.born) / 0.9;
      r.mesh.visible = t >= 0 && t < 1;
      if (!r.mesh.visible) continue;
      r.mesh.scale.setScalar(1 + t * (reduced ? 0.6 : 2.2));
      (r.mesh.material as T.MeshBasicMaterial).opacity = (1 - t) * 0.85;
    }
    for (const s of sparks) {
      const t = (clock - s.born) / 0.7;
      s.mesh.visible = !reduced && t >= 0 && t < 1;
      if (!s.mesh.visible) continue;
      s.mesh.position.copy(s.origin).addScaledVector(s.dir, t * 2.4);
      s.mesh.position.y -= t * t * 1.4;
      s.mesh.scale.setScalar(1 - t);
      s.mesh.rotation.y = clock * 9;
    }
  }

  return {
    frame,
    dispose() {
      root.removeFromParent();
      disposables.forEach((d) => d.dispose());
    },
  };
}
