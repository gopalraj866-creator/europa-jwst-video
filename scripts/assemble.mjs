// Concatenate rendered segments, mux the mastered audio, write final MP4 + chapters + SRT + description.
//   node scripts/assemble.mjs --mode full --name europa_jwst_4k --segments build/segments --audio build/audio/full
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PROJECT_ROOT } from './serve.mjs';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? [...acc, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : acc), []));
const mode = a.mode || 'full', name = a.name || `europa_jwst_${mode}`;
const segDir = path.resolve(PROJECT_ROOT, a.segments || 'build/segments');
const audioDir = path.resolve(PROJECT_ROOT, a.audio || `build/audio/${mode}`);
const outDir = path.resolve(PROJECT_ROOT, a.out || 'build/final'); fs.mkdirSync(outDir, { recursive: true });

const segs = fs.readdirSync(segDir).filter((f) => /^seg_\d+\.mp4$/.test(f)).sort();
if (!segs.length) throw new Error('no segments found in ' + segDir);
const list = path.join(outDir, `${name}_list.txt`);
fs.writeFileSync(list, segs.map((s) => `file '${path.join(segDir, s)}'`).join('\n'));
const silent = path.join(outDir, `${name}_video.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent], { stdio: 'inherit' });

const final = path.join(outDir, `${name}.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', silent, '-i', path.join(audioDir, 'mix.m4a'), '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
fs.rmSync(silent); fs.rmSync(list);
for (const f of ['captions.srt', 'master.flac']) if (fs.existsSync(path.join(audioDir, f))) fs.copyFileSync(path.join(audioDir, f), path.join(outDir, `${name}_${f}`));

// chapters for the YouTube description (full mode)
const tl = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'src/data/timeline.json'), 'utf8'))[mode];
const titles = { hook: 'Introduction', meet: 'Meet Europa', scale: 'How big is Europa?', ocean: 'The hidden ocean', tides: 'Tidal heating', carbon: 'Why carbon matters', webb: 'The James Webb Space Telescope', l2: 'Parked at L2', observe: 'How Webb reads spectra', discovery: 'The discovery: CO₂ at Tara Regio', flyover: 'Chaos terrain up close', source: 'Where did the carbon come from?', caveats: 'What we do not know', next: 'Europa Clipper & Juice', outro: 'Wrap-up' };
let acc = 0; const lines = [];
for (const e of tl) { const m = Math.floor(acc / 60), s = acc % 60; lines.push(`${m}:${String(s).padStart(2, '0')} ${titles[e.scene] || e.scene}`); acc += e.dur; }
fs.writeFileSync(path.join(outDir, `${name}_chapters.txt`), lines.join('\n') + '\n');
console.log('[assemble] wrote', final, `(${(fs.statSync(final).size / 1e6).toFixed(1)} MB)`);
