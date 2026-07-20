import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/full-roster-render-v4'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function capture(hero, width, height, shop = false, name = hero) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=5&qaHero=${hero}&lang=zh`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1300)
  if (shop) {
    await page.getByRole('button', { name: '暂停' }).dispatchEvent('pointerdown')
    await page.waitForTimeout(120)
    await page.getByRole('button', { name: /角色收藏/ }).click()
    await page.waitForTimeout(900)
  }
  await page.screenshot({ path: `${out}/${name}-${width}x${height}.png` })
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, canvases: document.querySelectorAll('canvas').length }))
  console.log(JSON.stringify({ name, shop, metrics, errors }))
  await page.close()
}

await capture('combatMech', 390, 844, false, '07-recheck-game-mech-special-crowd')
await capture('combatMech', 390, 844, true, '08-recheck-shop-mech')
await capture('viking', 390, 844, true, '09-recheck-shop-viking')
await capture('rabbit', 390, 844, true, '10-recheck-shop-rabbit')
await capture('minotaur', 320, 568, true, '11-recheck-shop-minotaur-short')
await capture('duck', 320, 568, false, '12-recheck-game-duck-special-crowd-short')

const audit = await browser.newPage({ viewport: { width: 390, height: 844 } })
const auditErrors = []
audit.on('console', message => { if (message.type() === 'error') auditErrors.push(message.text()) })
await audit.goto('http://127.0.0.1:5173/?qaLevel=5&qaHero=commuter&lang=zh', { waitUntil: 'networkidle' })
await audit.getByRole('button', { name: '暂停' }).dispatchEvent('pointerdown')
await audit.getByRole('button', { name: /角色收藏/ }).click()
await audit.waitForTimeout(500)
const names = []
for (let index = 0; index < 52; index += 1) {
  names.push(await audit.locator('.got-collection__identity > strong').innerText())
  await audit.getByRole('button', { name: '下一个角色' }).click()
  await audit.waitForTimeout(35)
}
console.log(JSON.stringify({ name: '13-all-heroes-audit', count: names.length, unique: new Set(names).size, first: names[0], last: names.at(-1), auditErrors }))
await audit.close()
await browser.close()
