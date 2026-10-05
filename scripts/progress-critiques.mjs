// Write each track's latest critic feedback to progress/critiques/<id>.md for the next round's builders.
// Usage: node scripts/progress-critiques.mjs <round>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const round = Number(process.argv[2]);
const log = JSON.parse(readFileSync('progress/log.json', 'utf8'));
mkdirSync('progress/critiques', { recursive: true });
for (const p of log.pieces) {
  const history = p.rounds
    .filter((r) => r.verdict)
    .map(
      (r) =>
        `- Round ${r.round}: ${r.verdict.oursWins ? 'ours won' : 'reference won'} (votes ${r.verdict.votes.map((v) => (v ? 'ours' : 'ref')).join(', ')}). Scores ours/ref: ${Object.entries(r.verdict.scores)
          .map(([k, s]) => `${k} ${s.ours}/${s.reference}`)
          .join(', ')}`,
    )
    .join('\n');
  const last = [...p.rounds].reverse().find((r) => r.verdict);
  if (!last) continue;
  const fixes = [...new Set(last.verdict.fixes)].slice(0, 10);
  writeFileSync(
    `progress/critiques/${p.id}.md`,
    `# ${p.title} — critique after round ${round}

Judged scene: ${p.scene} · reference: ${p.ref} (${p.refLabel})
Latest capture of ours: ${last.image}

## Score history
${history}

## Biggest remaining gap (critics' words)
${last.verdict.biggestGap}

## Fixes the critics asked for
${fixes.map((f) => `- ${f}`).join('\n')}
${(p.notes ?? []).length ? `\n## Notes from the lead\n${p.notes.map((n) => `- ${n}`).join('\n')}\n` : ''}`,
  );
}
console.log('critiques written');
