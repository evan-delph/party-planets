// Build the gauntlet loop's progress page from progress/log.json and the
// round screenshots. Output: progress/index.html (self-contained; our own
// screenshots only — the reference images are never embedded).
// Usage: node scripts/progress-page.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const log = JSON.parse(readFileSync('progress/log.json', 'utf8'));
const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const img = (path) =>
  path && existsSync(path)
    ? `data:image/jpeg;base64,${readFileSync(path).toString('base64')}`
    : '';

const status = (p) => {
  const last = p.rounds.at(-1);
  if (!last?.verdict) return ['queued', 'Waiting'];
  if (last.verdict.oursWins) return ['win', 'Ours wins'];
  return ['loss', `Reference wins · round ${last.round}`];
};
const wins = log.pieces.filter((p) => p.rounds.at(-1)?.verdict?.oursWins).length;
const totalRounds = Math.max(0, ...log.pieces.map((p) => p.rounds.length));

const pieces = log.pieces
  .map((p) => {
    const [state, label] = status(p);
    const last = p.rounds.at(-1);
    const v = last?.verdict;
    const scores = v?.scores
      ? Object.entries(v.scores)
          .map(
            ([k, s]) =>
              `<li><span>${esc(k)}</span><b class="${s.ours >= s.reference ? 'up' : 'down'}">${s.ours} · ${s.reference}</b></li>`,
          )
          .join('')
      : '';
    const strip = p.rounds
      .filter((r) => r.image)
      .map(
        (r) =>
          `<figure class="${r.verdict?.oursWins ? 'won' : ''}"><img src="${img(r.image)}" alt="${esc(p.title)}, round ${r.round}" loading="lazy"><figcaption>R${r.round}${r.verdict ? (r.verdict.oursWins ? ' · win' : ' · loss') : ''}</figcaption></figure>`,
      )
      .join('');
    return `<article class="piece ${state}" id="${esc(p.id)}">
  <header><div><span class="ref">vs ${esc(p.refLabel)}</span><h2>${esc(p.title)}</h2></div><span class="pill ${state}">${esc(label)}</span></header>
  <div class="body">
    <div class="hero">${last?.image ? `<img src="${img(last.image)}" alt="Latest ${esc(p.title)}">` : '<div class="empty">Baseline capture pending</div>'}</div>
    <div class="notes">
      ${v ? `<h3>Biggest remaining gap</h3><p>${esc(v.biggestGap)}</p>${scores ? `<h3>Ours · reference (0–10)</h3><ul class="scores">${scores}</ul>` : ''}` : '<p class="muted">No critique yet.</p>'}
      ${last?.build ? `<h3>Last change</h3><p class="muted">${esc(last.build)}</p>` : ''}
    </div>
  </div>
  ${strip ? `<div class="strip">${strip}</div>` : ''}
</article>`;
  })
  .join('\n');

const html = `<title>Party Planets Gauntlet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito+Sans:wght@400;600;700&display=swap">
<style>
/* Layout: a scoreboard of design tracks, each with its latest capture, the critic's verdict and a round-by-round film strip. */
:root {
  color-scheme: dark;
  --bg: #0b1226; --panel: #141d3a; --line: #26315a; --fg: #eef2ff; --muted: #9aa6cf;
  --win: #4fe0a0; --loss: #ff7a7a; --sun: #ffd54a; --accent: #7cc8ff;
  --display: 'Fredoka', 'Trebuchet MS', system-ui, sans-serif;
  --body: 'Nunito Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
body { background: var(--bg); color: var(--fg); font: 15px/1.5 var(--body); }
main { max-width: 1180px; margin: 0 auto; padding-inline: 16px; padding-block: 28px 56px; display: grid; gap: 22px; }
.top { display: grid; gap: 10px; }
.top h1 { font: 700 clamp(28px, 4vw, 40px)/1.1 var(--display); margin: 0; text-wrap: balance; }
.top p { margin: 0; color: var(--muted); max-width: 70ch; }
.board { display: flex; flex-wrap: wrap; gap: 10px; }
.stat { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px; display: grid; }
.stat b { font: 600 22px var(--display); font-variant-numeric: tabular-nums; }
.stat span { color: var(--muted); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
.piece { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 16px; display: grid; gap: 14px; min-width: 0; }
.piece.win { border-color: color-mix(in srgb, var(--win) 55%, var(--line)); }
.piece header { display: flex; justify-content: space-between; align-items: start; gap: 12px; flex-wrap: wrap; }
.piece h2 { font: 600 22px/1.2 var(--display); margin: 2px 0 0; }
.ref { color: var(--muted); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
.pill { border-radius: 999px; padding: 4px 12px; font-weight: 700; font-size: 13px; border: 1px solid var(--line); }
.pill.win { background: color-mix(in srgb, var(--win) 18%, transparent); color: var(--win); }
.pill.loss { background: color-mix(in srgb, var(--loss) 16%, transparent); color: var(--loss); }
.pill.queued { color: var(--muted); }
.body { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 760px) { .body { grid-template-columns: 1fr; } }
.hero img { width: 100%; border-radius: 12px; display: block; border: 1px solid var(--line); }
.empty { aspect-ratio: 16 / 10; border-radius: 12px; border: 1px dashed var(--line); display: grid; place-items: center; color: var(--muted); }
.notes { min-width: 0; }
.notes h3 { font: 600 13px var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); margin: 0 0 4px; }
.notes p { margin: 0 0 14px; }
.muted { color: var(--muted); }
.scores { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 4px; }
.scores li { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--line); padding-block: 3px; }
.scores b { font-variant-numeric: tabular-nums; }
.scores .up { color: var(--win); } .scores .down { color: var(--loss); }
.strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
.strip figure { margin: 0; flex: 0 0 150px; }
.strip img { width: 150px; border-radius: 8px; border: 2px solid var(--line); display: block; }
.strip figure.won img { border-color: var(--win); }
.strip figcaption { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
footer { color: var(--muted); font-size: 13px; }
</style>
<main>
  <section class="top">
    <h1>Party Planets Gauntlet</h1>
    <p>${esc(log.goal)}</p>
    <p><b>Bar:</b> ${esc(log.bar)}</p>
    <div class="board">
      <div class="stat"><b>${wins} / ${log.pieces.length}</b><span>Tracks winning</span></div>
      <div class="stat"><b>${totalRounds ? totalRounds - 1 : 0}</b><span>Rounds run</span></div>
      <div class="stat"><b>${esc(log.updated ?? '')}</b><span>Last update</span></div>
    </div>
  </section>
  ${pieces}
  <footer>Captures are real headless renders of the game (software WebGL, so lighting and anti-aliasing are slightly softer than a GPU). Reference screenshots are judged by the critics but not shown here.</footer>
</main>`;
writeFileSync('progress/index.html', html);
console.log(`progress/index.html (${Math.round(html.length / 1024)} KB)`);
