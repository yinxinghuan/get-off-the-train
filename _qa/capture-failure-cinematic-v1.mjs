import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/failure-cinematic-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function capture(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:5173/?lang=zh&qaFailAfter=0.9', { waitUntil: 'networkidle' })
  await page.waitForTimeout(260)
  await page.keyboard.press('ArrowUp')
  await page.waitForSelector('.got-fail-shot', { state: 'visible', timeout: 12000 })

  const waits = [120, 420, 620, 1500]
  let elapsed = 0
  const states = []
  for (let index = 0; index < waits.length; index++) {
    await page.waitForTimeout(waits[index])
    elapsed += waits[index]
    const state = await page.evaluate(() => ({
      cinematic: Boolean(document.querySelector('.got-fail-shot')),
      result: Boolean(document.querySelector('.got-panel--game-over')),
      timer: Boolean(document.querySelector('.got-timer')),
      pause: Boolean(document.querySelector('.got-pause')),
    }))
    states.push(state)
    await page.screenshot({ path: `${out}/${width}x${height}-${index + 1}-${elapsed}ms.png` })
  }

  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (!states.slice(0, 3).every(state => state.cinematic && !state.result && !state.timer && !state.pause)) throw new Error(`Cinematic staging failed: ${JSON.stringify(states)}`)
  if (!states[3].result || states[3].cinematic) throw new Error(`Result did not follow cinematic: ${JSON.stringify(states[3])}`)
  if (metrics.scrollWidth !== metrics.width) throw new Error(`Horizontal overflow: ${JSON.stringify(metrics)}`)
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ viewport: `${width}x${height}`, states, metrics, errors }))
  await page.close()
}

async function captureReducedMotion() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:5173/?lang=zh&qaFailAfter=0.9', { waitUntil: 'networkidle' })
  await page.keyboard.press('ArrowUp')
  await page.waitForSelector('.got-fail-shot', { state: 'visible', timeout: 12000 })
  await page.waitForSelector('.got-panel--game-over', { state: 'visible', timeout: 3000 })
  const result = await page.locator('.got-panel--game-over').isVisible()
  await page.screenshot({ path: `${out}/390x844-reduced-result.png` })
  if (!result) throw new Error('Reduced-motion failure result did not follow the shortened cinematic')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ reducedMotion: true, result, errors }))
  await page.close()
}

await capture(390, 844)
await capture(320, 568)
await captureReducedMotion()
await browser.close()
