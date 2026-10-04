'use client';
import { useEffect, useRef } from 'react';
import { Gem, Coins, Gift, Zap } from 'lucide-react';
import type { Action, Game } from './engine';

export default function Lottery({
  game,
  mine,
  busy,
  dispatch,
}: {
  game: Game;
  mine: boolean;
  busy: boolean;
  dispatch: (a: Action) => unknown;
}) {
  const ticket = game.lottery!,
    player = game.players[game.active];
  const canvas = useRef<HTMLCanvasElement>(null),
    sent = useRef(false),
    strokes = useRef(0);
  const reveal = () => {
    if (sent.current || !mine || busy || ticket.stage !== 'scratch') return;
    sent.current = true;
    dispatch({ type: 'lotteryScratch', lotteryId: ticket.id });
  };
  useEffect(() => {
    sent.current = false;
  }, [ticket.id, ticket.stage, busy]);
  useEffect(() => {
    if (ticket.stage !== 'scratch' || !canvas.current) return;
    const c = canvas.current.getContext('2d')!;
    c.globalCompositeOperation = 'source-over';
    const foil = c.createLinearGradient(0, 0, 340, 160);
    foil.addColorStop(0, '#b8c5d6');
    foil.addColorStop(0.5, '#f0f4f9');
    foil.addColorStop(1, '#a4b6cc');
    c.fillStyle = foil;
    c.fillRect(0, 0, 340, 160);
    c.fillStyle = '#45546c';
    c.textAlign = 'center';
    c.font = 'bold 22px system-ui';
    c.fillText('SCRATCH HERE', 170, 83);
    strokes.current = 0;
  }, [ticket.id, ticket.stage]);
  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!mine || busy || !e.buttons) return;
    const el = e.currentTarget,
      c = el.getContext('2d')!,
      rect = el.getBoundingClientRect();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(
      ((e.clientX - rect.left) * 340) / rect.width,
      ((e.clientY - rect.top) * 160) / rect.height,
      24,
      0,
      Math.PI * 2,
    );
    c.fill();
    if (++strokes.current % 4 === 0) {
      const pixels = c.getImageData(0, 0, 340, 160).data;
      let clear = 0;
      for (let i = 3; i < pixels.length; i += 16) if (pixels[i] < 64) clear++;
      if (clear / (pixels.length / 16) > 0.35) reveal();
    }
  }
  const result = ticket.result ?? 0;
  return (
    <section
      className="center-panel lottery-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lottery-title"
    >
      <span className="eyebrow">{player.avatar.name} · FREE LOTTERY STOP</span>
      <h2 id="lottery-title">Lucky sixteen</h2>
      <div className="lottery-prizes">
        <span>
          <Gem size={18} />
          <b>1</b> Diamond chest
        </span>
        <span>
          <Coins size={18} />
          <b>2</b> 100 coins
        </span>
        <span>
          <Zap size={18} />
          <b>3</b> Lucky +5 item
        </span>
      </div>
      <p>
        {ticket.stage === 'pick'
          ? 'Choose one card. Three winners, thirteen blanks.'
          : ticket.stage === 'scratch'
            ? `Card ${ticket.selected! + 1} is yours. Scratch the silver foil!`
            : result
              ? 'You found a winning card!'
              : 'No prize this time. Here are the three winning cards.'}
      </p>
      <div
        className="lottery-grid"
        role="group"
        aria-label="16 scratch-off cards"
      >
        {Array.from({ length: 16 }, (_, i) => {
          const value =
            ticket.stage === 'revealed' ? (ticket.cards?.[i] ?? 0) : undefined;
          return (
            <button
              key={i}
              className={`lottery-card ${ticket.selected === i ? 'chosen' : ''} ${value ? 'winner' : ''}`}
              disabled={!mine || busy || ticket.stage !== 'pick'}
              aria-label={
                value === undefined
                  ? `Choose card ${i + 1}`
                  : `Card ${i + 1}: ${value ? `prize ${value}` : 'blank'}${ticket.selected === i ? ', your card' : ''}`
              }
              onClick={() =>
                dispatch({
                  type: 'lotteryPick',
                  value: i,
                  lotteryId: ticket.id,
                })
              }
            >
              <small>{String(i + 1).padStart(2, '0')}</small>
              <strong>
                {value === undefined ? <Gift size={24} /> : value || '—'}
              </strong>
            </button>
          );
        })}
      </div>
      {ticket.stage === 'scratch' && (
        <>
          <div className="scratch-surface">
            <span>✦ ✦ ✦</span>
            <canvas
              ref={canvas}
              width={340}
              height={160}
              aria-label="Drag to scratch your card"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scratch(e);
              }}
              onPointerMove={scratch}
            />
          </div>
          {mine && (
            <button className="primary" disabled={busy} onClick={reveal}>
              Scratch & reveal <Sparkle />
            </button>
          )}
        </>
      )}
      {ticket.stage === 'revealed' && (
        <div aria-live="polite">
          <h3>
            {result === 1
              ? '1 · A chest with a free diamond!'
              : result === 2
                ? '2 · You won 100 coins!'
                : result === 3
                  ? '3 · You won a Lucky +5 item!'
                  : 'Blank card · better luck next time'}
          </h3>
          {result === 3 && (
            <p>
              Saved in your prize pouch, even with a full bag. Use it before
              rolling to add five spaces.
            </p>
          )}
          {mine && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                dispatch({ type: 'lotteryContinue', lotteryId: ticket.id })
              }
            >
              {game.diamondGoal && player.pearls >= game.diamondGoal
                ? 'Celebrate your win'
                : ticket.resumeTurn
                  ? 'Return to your roll'
                  : (game.remaining ?? 0) > 0 && !ticket.landingResolved
                    ? `Continue ${game.remaining} remaining spaces`
                    : 'Finish turn'}
            </button>
          )}
        </div>
      )}
      {!mine && (
        <p className="muted">
          {player.cpu
            ? 'Your rival is scratching a card…'
            : 'Waiting for your friend to choose and scratch…'}
        </p>
      )}
      <small className="lottery-footnote">
        Everyone stops here. Your remaining moves are saved.
      </small>
    </section>
  );
}
function Sparkle() {
  return <span aria-hidden="true">✦</span>;
}
