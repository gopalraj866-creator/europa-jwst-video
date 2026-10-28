// Builds the GitHub Actions matrices from the workflow inputs.
import fs from 'node:fs';
const FORMATS = {
  '1080p': { mode: 'full', w: 1920, h: 1080, name: 'europa_jwst_1080p' },
  '4k': { mode: 'full', w: 3840, h: 2160, name: 'europa_jwst_4k' },
  shorts: { mode: 'short', w: 1080, h: 1920, name: 'europa_jwst_shorts' }
};
const sel = (process.env.FORMAT || '1080p').toLowerCase();
const chosen = sel === 'all' ? Object.keys(FORMATS) : [sel];
if (chosen.some((c) => !FORMATS[c])) throw new Error(`unknown format "${sel}"`);
const parallel = Math.max(1, Math.min(20, parseInt(process.env.PARALLEL || '16', 10)));
const include = [];
for (const f of chosen) {
  const chunks = f === 'shorts' ? Math.min(parallel, 4) : parallel;
  for (let c = 0; c < chunks; c++) include.push({ format: f, ...FORMATS[f], chunk: c, chunks });
}
const formats = chosen.map((f) => ({ format: f, ...FORMATS[f] }));
const modes = [...new Set(formats.map((f) => f.mode))];
const out = process.env.GITHUB_OUTPUT;
const lines = [`matrix=${JSON.stringify({ include })}`, `formats=${JSON.stringify({ include: formats })}`, `modes=${JSON.stringify(modes)}`];
if (out) fs.appendFileSync(out, lines.join('\n') + '\n'); else console.log(lines.join('\n'));
console.log(`planned ${include.length} render jobs for: ${chosen.join(', ')}`);
