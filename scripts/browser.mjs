// Launch Chromium with software WebGL (works on GitHub-hosted runners, which have no GPU).
import puppeteer from 'puppeteer';

export async function launch() {
  const executablePath = process.env.CHROME_PATH || undefined;
  return puppeteer.launch({
    executablePath,
    headless: true,
    protocolTimeout: 600000,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync',
      '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'
    ]
  });
}

export async function openPage(browser, url, { width, height }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  page.on('console', (m) => { const t = m.text(); if (/error|warn|fail/i.test(t) && !/GPU stall/i.test(t)) console.log('[page]', t.slice(0, 400)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 600)));
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__ready === true', { timeout: 600000 });
  return page;
}
