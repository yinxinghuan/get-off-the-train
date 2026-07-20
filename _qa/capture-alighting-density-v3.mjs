import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/alighting-density-v3'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function captureSequence(level, name, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=${level}&qaSpeed=2&lang=zh`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.got-timer__time', { timeout: 60000 })
  const initialTime = await page.locator('.got-timer__time').evaluate(element => Number(element.textContent?.match(/\d+/)?.[0]))
  await page.waitForFunction(
    target => Number(document.querySelector('.got-timer__time')?.textContent?.match(/\d+/)?.[0]) <= target,
    initialTime - 2,
    { timeout: 20000 },
  )
  const checkpoints = [0, 1200, 1200, 1200]
  let elapsed = 0
  for (let index = 0; index < checkpoints.length; index++) {
    if (checkpoints[index]) await page.waitForTimeout(checkpoints[index])
    elapsed += checkpoints[index]
    await page.screenshot({ path: `${out}/${name}-${index + 1}-${elapsed}ms-active-${width}x${height}.png` })
  }
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    countdown: document.querySelector('.got-timer__time')?.textContent,
  }))
  console.log(JSON.stringify({ level, name, initialTime, metrics, errors }))
  await page.close()
}

await captureSequence(1, 'level01-learning', 390, 844)
await captureSequence(5, 'level05-six-exiting', 390, 844)
await captureSequence(11, 'level11-nine-exiting', 320, 568)
await captureSequence(20, 'level20-twelve-exiting', 390, 844)

await browser.close()
