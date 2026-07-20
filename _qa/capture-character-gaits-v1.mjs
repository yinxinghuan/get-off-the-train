import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/character-gaits-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function capture(hero, width = 390, height = 844) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=2&qaHero=${hero}&qaRun=1&qaWalk=1&lang=zh`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.got-timer__time', { timeout: 60000 })
  await page.waitForTimeout(900)
  for (let index = 0; index < 4; index++) {
    await page.screenshot({ path: `${out}/${hero}-${index + 1}-${width}x${height}.png` })
    await page.waitForTimeout(150)
  }
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    countdown: document.querySelector('.got-timer__time')?.textContent,
  }))
  console.log(JSON.stringify({ hero, metrics, errors }))
  await page.close()
}

for (const hero of ['commuter', 'zombie', 'werewolf', 'combatMech', 'ghost', 'dog', 'rabbit', 'duck']) {
  await capture(hero)
}
await capture('werewolf', 320, 568)
await browser.close()
