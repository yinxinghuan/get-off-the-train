import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/library-fall-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function capture(hero, kind, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=2&qaHero=${hero}&qaFall=${kind}&lang=zh`, { waitUntil: 'networkidle' })
  for (const [name, delay] of [['standing', 720], ['loss', 360], ['contact', 250], ['rising', 390], ['recovered', 520]]) {
    await page.waitForTimeout(delay)
    await page.screenshot({ path: `${out}/${hero}-${kind}-${name}-${width}x${height}.png` })
  }
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  console.log(JSON.stringify({ hero, kind, metrics, errors }))
  await page.close()
}

await capture('paramedic', 'forward', 390, 844)
await capture('viking', 'side', 320, 568)
await browser.close()
