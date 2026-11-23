const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { once } = require('node:events');

(async () => {
  const server = spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: 'ignore' });
  let browser;
  try {
    await new Promise(resolve => setTimeout(resolve, 1200));
    browser = await chromium.launch({ headless: true });
    mkdirSync('visual-review', { recursive: true });
    for (const viewport of [
      { name: 'escritorio', width: 1440, height: 900 },
      { name: 'tablet', width: 820, height: 900 },
      { name: 'movil', width: 390, height: 844 }
    ]) {
      const page = await browser.newPage({viewport: {width: viewport.width, height: viewport.height}, reducedMotion: 'reduce', deviceScaleFactor: 1});
      const errors = [];
      page.on('pageerror', err => errors.push(String(err)));
      await page.goto('http://127.0.0.1:4173/', {waitUntil: 'domcontentloaded'});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1400);
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < pageHeight; y += Math.floor(viewport.height * .75)) {
        await page.evaluate(y => window.scrollTo(0, y), y);
        await page.waitForTimeout(100);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1100);
      const metrics = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight
      }));
      if (metrics.scrollWidth > metrics.viewportWidth + 1) {
        throw Error(viewport.name + ' has horizontal overflow: ' + JSON.stringify(metrics));
      }
      if (errors.length) throw Error(viewport.name + ' JS errors: ' + errors.join('; '));
      await page.screenshot({path: 'visual-review/' + viewport.name + '-completo.jpg', fullPage: true, type: 'jpeg', quality: 72, animations: 'disabled'});
      console.log('VISUAL', viewport.name, JSON.stringify(metrics));
      if (viewport.width <= 1023) {
        await page.locator('#navToggle').click();
        await page.waitForTimeout(600);
        const closeGlyph = await page.locator('#navToggle').evaluate(el => getComputedStyle(el, '::after').content);
        if (!closeGlyph.includes('×')) throw Error(viewport.name + ' menu close glyph is not visible by CSS');
        await page.screenshot({path: 'visual-review/' + viewport.name + '-menu-abierto.jpg', fullPage: false, type: 'jpeg', quality: 78, animations: 'disabled'});
        const opened = await page.locator('#navToggle').getAttribute('aria-expanded');
        if (opened !== 'true') throw Error('menu failed on ' + viewport.name);
      }
      await page.close();
    }
    const page = await browser.newPage({viewport: {width:1200,height:630},deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:4173/black-barber-og.png');
    await page.screenshot({path: 'visual-review/og-final.png', fullPage: true});
    await page.close();
    console.log('Visual screenshots saved.');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
})().catch(err => { console.error(err); process.exitCode=1; });
