// 1280x720 YouTube thumbnail:  node scripts/thumbnail.mjs  ->  build/final/thumbnail.jpg
import fs from 'node:fs';
import path from 'node:path';
import { startServer, PROJECT_ROOT } from './serve.mjs';
import { launch, openPage } from './browser.mjs';
const { server, port } = await startServer();
const browser = await launch();
const page = await openPage(browser, `http://127.0.0.1:${port}/src/index.html?mode=full&w=1280&h=720&bake=1&samples=4`, { width: 1280, height: 720 });
const data = await page.evaluate(async () => {
  await window.renderDebug('discovery', 0.6, 54, {});
  const c = window.__canvas, g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 1280, 0); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
  g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 16; g.textBaseline = 'alphabetic';
  g.fillStyle = '#6dffc2'; g.font = '700 46px "Space Grotesk", sans-serif'; g.fillText('JWST FOUND', 60, 250);
  g.fillStyle = '#fff'; g.font = '700 128px "Space Grotesk", sans-serif'; g.fillText('CO₂', 56, 380);
  g.fillStyle = '#fff'; g.font = '700 84px "Space Grotesk", sans-serif'; g.fillText('ON EUROPA', 60, 470);
  g.fillStyle = '#7fd8ff'; g.font = '600 34px "Space Grotesk", sans-serif'; g.fillText('Is there carbon for life under the ice?', 62, 540);
  return c.toDataURL('image/jpeg', 0.95);
});
const out = path.join(PROJECT_ROOT, 'build/final'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'thumbnail.jpg'), Buffer.from(data.split(',')[1], 'base64'));
console.log('wrote build/final/thumbnail.jpg');
await browser.close(); server.close();
