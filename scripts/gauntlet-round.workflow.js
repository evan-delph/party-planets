export const meta = {
  name: 'gauntlet-round',
  description: 'One gauntlet round: per design track, builder improves it, then fresh blind A/B critics judge it against the Mario Party reference',
  whenToUse: 'Each round of the Party Planets gauntlet loop',
  phases: [
    { title: 'Baseline', detail: 'capture + blind critique where no critique exists yet' },
    { title: 'Build', detail: 'one builder per track' },
    { title: 'Judge', detail: 'capture + two independent blind A/B critics per track' },
  ],
}

const R = args.round
const ROOT = args.root

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    winner: { type: 'string', enum: ['A', 'B'] },
    confidence: { type: 'number' },
    scores: {
      type: 'object',
      properties: {
        art_direction: { type: 'object', properties: { A: { type: 'number' }, B: { type: 'number' } }, required: ['A', 'B'] },
        lighting_materials: { type: 'object', properties: { A: { type: 'number' }, B: { type: 'number' } }, required: ['A', 'B'] },
        composition_readability: { type: 'object', properties: { A: { type: 'number' }, B: { type: 'number' } }, required: ['A', 'B'] },
        ui_craft: { type: 'object', properties: { A: { type: 'number' }, B: { type: 'number' } }, required: ['A', 'B'] },
        fun_personality: { type: 'object', properties: { A: { type: 'number' }, B: { type: 'number' } }, required: ['A', 'B'] },
      },
      required: ['art_direction', 'lighting_materials', 'composition_readability', 'ui_craft', 'fun_personality'],
    },
    A_biggest_gap: { type: 'string' },
    B_biggest_gap: { type: 'string' },
    A_fixes: { type: 'array', items: { type: 'string' } },
    B_fixes: { type: 'array', items: { type: 'string' } },
  },
  required: ['winner', 'confidence', 'scores', 'A_biggest_gap', 'B_biggest_gap', 'A_fixes', 'B_fixes'],
}
const CAPTURE_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, image: { type: 'string' }, note: { type: 'string' } },
  required: ['ok', 'image'],
}
const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    typecheck_clean: { type: 'boolean' },
  },
  required: ['summary', 'files', 'typecheck_clean'],
}

function captureAgent(p, tag, oursLetter) {
  const refLetter = oursLetter === 'A' ? 'B' : 'A'
  const ours = `progress/round-${R}/${p.id}${tag}.jpg`
  return agent(
    `Working directory: ${ROOT} (Windows, PowerShell). Capture one screenshot and prepare a blind pair. Run exactly:
1. node scripts/shot.mjs "${p.scene}" "${ours}"
   (headless Chrome capture of the dev server at http://localhost:3000; takes 30-90 s; the script restarts the dev server itself if it is down. If it throws, retry once.)
2. New-Item -ItemType Directory -Force progress/round-${R}/blind | Out-Null
3. Copy-Item "${ours}" "progress/round-${R}/blind/${p.id}${tag}-${oursLetter}.jpg" -Force
4. Copy-Item "${p.ref}" "progress/round-${R}/blind/${p.id}${tag}-${refLetter}.jpg" -Force
Then Read "${ours}" once to confirm it shows a rendered game scene (not a blank page or a loading screen). If it is blank or loading, run step 1 again with a longer wait: node scripts/shot.mjs "${p.scene}" "${ours}" 1280 800 35000, and repeat steps 3-4.
Do not edit any files. Return ok=true with image="${ours}" if the capture shows the scene.`,
    { label: `capture:${p.id}${tag}`, phase: tag === '-before' ? 'Baseline' : 'Judge', schema: CAPTURE_SCHEMA, effort: 'low' },
  )
}

function criticAgent(p, tag, k) {
  return agent(
    `You are a harsh, experienced art director and UX lead judging two screenshots of party video games for visual and design quality. Image A: ${ROOT}/progress/round-${R}/blind/${p.id}${tag}-A.jpg  Image B: ${ROOT}/progress/round-${R}/blind/${p.id}${tag}-B.jpg
Read both images (use the Read tool on each path). Both show the same kind of moment (${p.kind}). Judge only what is on screen. Do not reward brand familiarity, characters you recognise, or resolution/compression differences; judge craft.
Pick the frame that looks more like a polished, fun, modern AAA party game: art direction and cohesion, lighting/materials/colour, composition and readability, UI and typography craft (score UI on what is visible; if one has little UI, judge the UI it has), and fun/personality/charm. Score each 0-10 for both images. Be strict: a 10 is best-in-class console polish.
Then, for EACH image, name the single biggest thing holding it back compared with the other, and give 3-6 concrete, specific, buildable fixes (what to change on screen, e.g. "replace the flat cyan floor with a shaded water surface with caustics, foam edges and depth falloff"), most impactful first. Return the structured verdict. Critic ${k}.`,
    { label: `critic${k}:${p.id}${tag}`, phase: tag === '-before' ? 'Baseline' : 'Judge', schema: CRITIC_SCHEMA, effort: 'high' },
  )
}

function mapVerdict(v, oursLetter) {
  if (!v) return null
  const refLetter = oursLetter === 'A' ? 'B' : 'A'
  const scores = {}
  for (const [k, s] of Object.entries(v.scores)) scores[k] = { ours: s[oursLetter], reference: s[refLetter] }
  return {
    oursWins: v.winner === oursLetter,
    confidence: v.confidence,
    scores,
    biggestGap: v[`${oursLetter}_biggest_gap`],
    fixes: v[`${oursLetter}_fixes`],
  }
}

async function judge(p, tag, index) {
  // Alternate which side ours sits on so position bias averages out.
  const oursLetter = (R + index + (tag === '-before' ? 1 : 0)) % 2 === 0 ? 'A' : 'B'
  const cap = await captureAgent(p, tag, oursLetter)
  if (!cap || !cap.ok) return { image: null, verdicts: [], oursWins: false }
  const verdicts = (await parallel([1, 2].map((k) => () => criticAgent(p, tag, k))))
    .map((v) => mapVerdict(v, oursLetter))
    .filter(Boolean)
  const merged = {}
  for (const v of verdicts)
    for (const [k, s] of Object.entries(v.scores)) {
      merged[k] ??= { ours: 0, reference: 0 }
      merged[k].ours += s.ours / verdicts.length
      merged[k].reference += s.reference / verdicts.length
    }
  for (const k of Object.keys(merged)) {
    merged[k].ours = Math.round(merged[k].ours * 10) / 10
    merged[k].reference = Math.round(merged[k].reference * 10) / 10
  }
  return {
    image: cap.image,
    verdicts,
    oursWins: verdicts.length === 2 && verdicts.every((v) => v.oursWins),
    scores: merged,
    biggestGap: verdicts.map((v) => v.biggestGap).join(' / '),
    fixes: verdicts.flatMap((v) => v.fixes),
  }
}

function builderPrompt(p, critique) {
  return `You are the builder for one design track in a "gauntlet loop" on Party Planets, an original three.js/React party game (repo: ${ROOT}; Windows, PowerShell; Node via 'C:\\Program Files\\nodejs\\node.exe'; Blender 5 at C:\\Tools\\Blender\\blender.exe if you need models).

GOAL: a modern, AAA-quality party game at the level of the latest Mario Party, in our own original style: impeccable, fun, designer UI and super fun minigames with standout aesthetics.
BAR: blind A/B against a real Mario Party screenshot. After you finish, fresh critics compare a capture of your scene against the reference without knowing which is which. You win only if both pick ours.

YOUR TRACK: ${p.title}
${p.brief}
Scene you are judged on: "${p.scene}". Capture it any time: node scripts/shot.mjs "${p.scene}" progress/round-${R}/${p.id}-wip.jpg  (headless Chrome, 30-90 s, then Read the jpg). Scenes are defined in game/shot.ts.
Reference image (the bar): ${ROOT}/${p.ref}. Look at it: match its level of polish, not its content.

LATEST CRITIQUE OF OUR CURRENT VERSION:
${critique}

HOW TO WORK
- You decide the approach. Aim for the biggest visible jump in quality this round, not a cosmetic tweak. Check your work with captures, and iterate until it clearly looks better than the previous capture.
- Files you own: ${p.files}. Seven other builders are editing other tracks in this same working tree right now. Do not touch their files. In shared files (game/Party.tsx), edit only your own region; Read immediately before every Edit; never rewrite whole files, reformat, or move code you do not own.
- Never run git commit, checkout, stash, reset or clean. The lead commits between rounds.
- Original IP only: never copy Nintendo characters, logos, art, maps or layouts. The references show a quality level, not content to copy. Keep our green aliens, planets and boards.
- Don't change the main menu (the solar-system scene, planets, camera, menu flow and options), apart from its UI styling and the top game logo.
- Don't change game rules or simulations (engine.ts, simulation and rules files) unless purely visual.
- Keep it fast enough for an ordinary laptop GPU: no huge textures (stay at or under 2K), and don't add hundreds of draw calls.
- Large new files in public/ can briefly crash the dev-server watcher; scripts/shot.mjs restarts it automatically.
- Never leave debug overlays, helper spheres, console text boxes or other diagnostics on screen, not even briefly: other tracks capture the same game while you work. Remove any you add before your next capture.
- Removing earlier work is fine when it makes the frame better; you don't have to keep everything from previous rounds.
- Before finishing: run npx tsc --noEmit -p . and make sure it is clean for your files. If you touched shared game code, also run node scripts/test.mjs.
Return a short summary of what you changed (written for the user), the files you touched, and whether the typecheck was clean.`
}

const results = await pipeline(
  args.pieces,
  async (p, _orig, i) => {
    if (p.critique) return { critique: p.critique, before: null }
    const before = await judge(p, '-before', i)
    const critique = before.verdicts.length
      ? `Baseline verdict: ${before.oursWins ? 'ours won' : 'the reference won'}. Biggest gap: ${before.biggestGap}\nFixes the critics asked for:\n- ${before.fixes.join('\n- ')}`
      : 'No critique available; compare your capture with the reference yourself and fix the biggest gap.'
    return { critique, before }
  },
  async (prev, p) => {
    const build = await agent(builderPrompt(p, prev.critique), { label: `build:${p.id}`, phase: 'Build', schema: BUILD_SCHEMA })
    return { ...prev, build }
  },
  async (prev, p, i) => {
    const after = await judge(p, '', i)
    log(`${p.id}: ${after.oursWins ? 'OURS WINS' : 'reference wins'}`)
    return { id: p.id, before: prev.before, build: prev.build, after }
  },
)
return results.filter(Boolean)