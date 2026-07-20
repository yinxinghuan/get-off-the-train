import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/animal-scale-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function capture(hero, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=5&qaHero=${hero}&lang=zh`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/${hero}-game-${width}x${height}.png` })
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  console.log(JSON.stringify({ hero, metrics, errors }))
  await page.close()
}

async function captureShop(hero, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=5&qaHero=${hero}&lang=zh`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '暂停' }).dispatchEvent('pointerdown')
  await page.getByRole('button', { name: /角色收藏/ }).click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/${hero}-shop-${width}x${height}.png` })
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  console.log(JSON.stringify({ hero, shop: true, metrics, errors }))
  await page.close()
}

await capture('bear', 390, 844)
await capture('cow', 390, 844)
await capture('fox', 390, 844)
await capture('frog', 390, 844)
await capture('rabbit', 320, 568)
await captureShop('bear', 390, 844)
await captureShop('frog', 390, 844)
await captureShop('rabbit', 320, 568)
await captureShop('businessman', 390, 844)
await browser.close()
