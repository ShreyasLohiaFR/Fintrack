// Capture screenshots of the real, built React interface (not mockups).
// Run by .github/workflows/screenshots.yml on GitHub Actions.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const out = path.join(__dirname, '..', 'docs', 'screenshots');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [name, route, heading] of [
      ['landing', '/', 'Know where the month'],
      ['login', '/login', null],
      ['register', '/register', null],
    ]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      });
      await page.goto('http://127.0.0.1:4173' + route, { waitUntil: 'networkidle' });
      await page.locator('body').waitFor();
      if (heading) await page.getByRole('heading', { name: /Know where the month/i }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
      await page.close();
      console.log('Captured ' + name + '.png');
    }
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
