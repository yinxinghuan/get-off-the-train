import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/special-trains-weather-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function capture(level, name, waits = [900]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=${level}&qaSpeed=3&lang=zh`, { waitUntil: 'networkidle' })
  let elapsed = 0
  for (let index = 0; index < waits.length; index++) {
    await page.waitForTimeout(waits[index])
    elapsed += waits[index]
    await page.screenshot({ path: `${out}/${name}-${index + 1}-${elapsed}ms.png` })
  }
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  console.log(JSON.stringify({ level, name, metrics, errors }))
  await page.close()
}

await capture(10, 'nurse-train')
await capture(12, 'skeleton-mummy-train')
await capture(14, 'fog-night', [900, 2200])
await capture(20, 'security-train')
await capture(22, 'leak-night', [900, 2200])
await capture(30, 'typhoon-night', [900, 1800, 1800])
await capture(42, 'robot-train')

await browser.close()
