import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const browser = await chromium.launch({ headless: true })
for (const [hero, level, width, height] of [['zombie', 1, 390, 844], ['werewolf', 5, 320, 568]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=${level}&qaHero=${hero}&qaRun=1&qaSpeed=3&lang=zh`, { waitUntil: 'networkidle' })
  await page.locator('.got-panel h2').waitFor({ timeout: 30000 })
  const result = await page.locator('.got-panel h2').textContent()
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  console.log(JSON.stringify({ hero, level, result, metrics, errors }))
  await page.close()
}
await browser.close()
