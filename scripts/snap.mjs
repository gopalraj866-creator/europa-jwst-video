// Render still frames for quick visual QA:
//   node scripts/snap.mjs --scene hook --p 0.5 [--mode full|short] [--res 1280x720] [--out build/snap]
//   node scripts/snap.mjs --all [--p 0.5]
import fs from 'node:fs';
import path from 'node:path';
import { startServer, PROJECT_ROOT } from './serve.mjs';
import { launch, openPage } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const mode = args.mode || 'full';
const [w, h] = (args.res || (mode === 'short' ? '540x960' : '960x540')).split('x').map(Number);
const ps = String(args.p ?? '0.5').split(',').map(Number);
const outDir = path.resolve(PROJECT_ROOT, args.out || 'build/snap'); fs.mkdirSync(outDir, { recursive: true });
const bake = args.bake || 0.5;

const { server, port } = await startServer();
const browser = await launch();
const page = await openPage(browser, `http://127.0.0.1:${port}/src/index.html?mode=${mode}&w=${w}&h=${h}&bake=${bake}&samples=${args.samples ?? 0}&captions=${args.captions ?? 0}`, { width: w, height: h });
const info = await page.evaluate(() => window.__info);
if (args.debug) {
  for (const p of ps) {
    const data = await page.evaluate((n, p) => window.renderDebug(n, p), String(args.debug), p);
    const f = path.join(outDir, `debug_${args.debug}_${String(p).replace('.', '')}.jpg`);
    fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64')); console.log(f);
  }
  await browser.close(); server.close(); process.exit(0);
}
const wanted = args.all ? info.entries : info.entries.filter((e) => String(args.scene).split(',').includes(e.id) || String(args.scene).split(',').includes(e.scene));
for (const e of wanted) {
  for (const p of ps) {
    const t0 = Date.now();
    const data = await page.evaluate((t) => window.renderFrame(t), e.start + e.dur * p);
    const f = path.join(outDir, `${mode}_${e.id}_${String(p).replace('.', '')}.jpg`);
    fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
    console.log(f, `${Date.now() - t0} ms`);
  }
}
await browser.close(); server.close();
