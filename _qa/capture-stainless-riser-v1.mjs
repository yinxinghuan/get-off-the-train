import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/stainless-riser-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function capture(width, height, level = 1) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=${level}&qaSeatStand=1&lang=zh`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(420)
  await page.screenshot({ path: `${out}/01-stainless-seated-${width}x${height}.png` })
  await page.waitForTimeout(720)
  await page.screenshot({ path: `${out}/02-passenger-preparing-${width}x${height}.png` })
  await page.waitForTimeout(520)
  await page.screenshot({ path: `${out}/03-passenger-rising-${width}x${height}.png` })
  await page.waitForTimeout(720)
  await page.screenshot({ path: `${out}/04-passenger-blocking-aisle-${width}x${height}.png` })
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    countdown: document.querySelector('.got-hud__time')?.textContent,
  }))
  console.log(JSON.stringify({ width, height, level, metrics, errors }))
  await page.close()
}

await capture(390, 844, 1)
await capture(320, 568, 4)
await browser.close()
