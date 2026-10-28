import fs from 'node:fs';
const tl = JSON.parse(fs.readFileSync(new URL('../src/data/timeline.json', import.meta.url), 'utf8'));
for (const mode of ['full', 'short']) {
  const total = tl[mode].reduce((s, e) => s + e.dur, 0);
  const words = tl[mode].reduce((s, e) => s + e.say.join(' ').split(/\s+/).length, 0);
  console.log(`${mode}: ${tl[mode].length} scenes, ${total}s (${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}), ${words} words of narration`);
}
if (tl.full.reduce((s, e) => s + e.dur, 0) < 470) { console.error('full video is shorter than ~8 minutes'); process.exit(1); }
