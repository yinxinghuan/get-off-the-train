import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/difficulty-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function sequence(level, name, waits) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=${level}&qaSpeed=5&lang=zh`, { waitUntil: 'networkidle' })
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

await sequence(6, 'level06-baseline', [900, 4500])
await sequence(15, 'level15-inflow', [900, 6500])
await sequence(20, 'level20-crossflow', [900, 6500])
await sequence(40, 'level40-max', [900, 2800, 2800])

await browser.close()
