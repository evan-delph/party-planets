'use client';
import { useEffect, useRef } from 'react';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Game } from './engine';
import { disposeObject } from './visuals';

export default function DiceRoll({
  dice,
  clockOffset,
  reduced,
}: {
  dice: NonNullable<Game['dice']>;
  clockOffset: number;
  reduced: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const offset = useRef(clockOffset);
  offset.current = clockOffset;
  const total = dice.values.reduce((a, b) => a + b, 0) + dice.bonus;
  useEffect(() => {
    const root = holder.current!;
    window.dispatchEvent(
      new CustomEvent('sp-sound', { detail: { kind: 'dice', delta: 0 } }),
    );
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(440, 270);
    renderer.setClearColor(0, 0);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    root.appendChild(renderer.domElement);
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(35, 440 / 270, 0.1, 100);
    camera.position.set(0, 0, 9);
    scene.add(new T.HemisphereLight('#fffaf0', '#43779c', 3));
    const light = new T.DirectionalLight('#ffffff', 4);
    light.position.set(-3, 5, 6);
    scene.add(light);
    const cubes = dice.values.map((value, i) => {
      const g = new T.Group();
      scene.add(g);
      g.position.x = (i - (dice.values.length - 1) / 2) * 2.7;
      const body = new T.Mesh(
        new RoundedBoxGeometry(2, 2, 2, 3, 0.17),
        new T.MeshStandardMaterial({
          color: '#fdf8da',
          roughness: 0.23,
          metalness: 0.15,
        }),
      );
      g.add(body);
      for (let face = 0; face < 6; face++) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const c = canvas.getContext('2d')!;
        c.fillStyle = '#144b54';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '900 172px Arial';
        c.fillText(
          String(face === 0 ? value : 1 + ((value + face) % 10)),
          128,
          141,
        );
        const material = new T.MeshBasicMaterial({
          map: new T.CanvasTexture(canvas),
          transparent: true,
          depthWrite: false,
        });
        const glyph = new T.Mesh(new T.PlaneGeometry(1.45, 1.45), material);
        const rotations = [
          [0, 0],
          [0, Math.PI / 2],
          [0, Math.PI],
          [0, -Math.PI / 2],
          [-Math.PI / 2, 0],
          [Math.PI / 2, 0],
        ];
        glyph.rotation.set(rotations[face][0], rotations[face][1], 0);
        glyph.position.set(0, 0, 1.008).applyEuler(glyph.rotation);
        g.add(glyph);
      }
      return g;
    });
    let raf = 0;
    const render = () => {
      const age = Date.now() + offset.current - dice.startedAt;
      const spinning = age < 1400,
        settle = T.MathUtils.smoothstep(age, 1400, 1700);
      cubes.forEach((g, i) => {
        const rotation = spinning ? age * 0.011 : (1 - settle) * 15.4;
        g.rotation.set(
          reduced ? 0 : rotation,
          reduced ? 0 : rotation * 0.8,
          spinning && !reduced ? Math.sin(age * 0.008 + i) * 0.25 : 0,
        );
        g.position.y =
          spinning && !reduced ? Math.sin(age * 0.012 + i) * 0.2 : 0;
      });
      root.style.opacity = String(1 - T.MathUtils.smoothstep(age, 2300, 2800));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(raf);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dice.startedAt, reduced]);
  return (
    <div className="dice-overlay" role="status">
      <span className="eyebrow">LET THE UNIVERSE DECIDE</span>
      <div className="dice-canvas" ref={holder} />
      <div
        className={
          'dice-result ' +
          (Date.now() + clockOffset >= dice.revealAt ? 'revealed' : '')
        }
      >
        <strong>{total}</strong>
        <span>SPACES {dice.bonus ? ' · +' + dice.bonus + ' BOOST' : ''}</span>
      </div>
    </div>
  );
}
