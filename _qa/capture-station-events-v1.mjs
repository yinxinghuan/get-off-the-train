import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/station-events-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function capture(name, level, wait = 900, width = 390, height = 844) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=${level}&lang=zh`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${out}/${name}-${width}x${height}.png` })
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  console.log(JSON.stringify({ name, level, metrics, errors }))
  await page.close()
}

async function captureGuide(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('http://127.0.0.1:5173/?lang=zh', { waitUntil: 'networkidle' })
  await page.waitForTimeout(850)
  await page.screenshot({ path: `${out}/00-google-touch-app-${width}x${height}.png` })
  console.log(JSON.stringify({ name: 'guide', width, height, errors }))
  await page.close()
}

await captureGuide(390, 844)
await captureGuide(320, 568)
await capture('01-police-special', 6)
await capture('02-pig-special', 9)
await capture('03-zombie-special', 12)
await capture('04-inflow-before', 15, 900)
await capture('05-inflow-after', 15, 7600)
await capture('06-all-exit-rising', 18, 3300)
await capture('07-all-exit-clearing', 18, 7600)
await capture('08-rescue-story', 21)
await capture('09-haunted-story', 30)
await capture('10-animal-rescue', 33)
await capture('11-blackout', 42)
await capture('12-red-alert', 45)
await capture('13-red-alert-small', 45, 900, 320, 568)

await browser.close()
