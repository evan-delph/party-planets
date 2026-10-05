// Append one gauntlet round's workflow result to progress/log.json.
// Usage: node scripts/progress-update.mjs <round> <result.json> "<label>"
import { readFileSync, writeFileSync } from 'node:fs';

const [round, file, label] = process.argv.slice(2);
const log = JSON.parse(readFileSync('progress/log.json', 'utf8'));
const results = JSON.parse(readFileSync(file, 'utf8'));
for (const r of results) {
  const piece = log.pieces.find((p) => p.id === r.id);
  if (!piece) continue;
  const after = r.after ?? {};
  piece.rounds.push({
    round: Number(round),
    image: after.image ?? null,
    build: r.build?.summary?.split('\n').find((l) => l.trim()) ?? '',
    verdict: after.verdicts?.length
      ? {
          oursWins: !!after.oursWins,
          votes: after.verdicts.map((v) => v.oursWins),
          scores: after.scores,
          biggestGap: after.verdicts[0]?.biggestGap ?? '',
          fixes: after.fixes ?? [],
        }
      : null,
  });
}
log.updated = label ?? `Round ${round}`;
writeFileSync('progress/log.json', JSON.stringify(log, null, 1));
console.log('updated', log.updated);
