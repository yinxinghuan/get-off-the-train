import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const browser = await chromium.launch({ headless: true })

async function verify(level) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:5173/?qaLevel=${level}&qaRun=1&qaSpeed=3&lang=zh`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.got-panel--level-clear, .got-panel--game-over', { timeout: 60000 })
  const panel = page.locator('.got-panel--level-clear, .got-panel--game-over')
  const cleared = await panel.evaluate(element => element.classList.contains('got-panel--level-clear'))
  const result = await panel.innerText()
  if (errors.length) throw new Error(`Level ${level} console errors: ${errors.join(' | ')}`)
  console.log(JSON.stringify({ level, cleared, result: result.replace(/\s+/g, ' ').trim() }))
  if (!cleared) throw new Error(`Level ${level} autorun did not clear`)
  await page.close()
}

await verify(1)
await verify(5)
await browser.close()
