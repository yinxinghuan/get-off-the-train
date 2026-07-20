import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/station-events-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

const guide = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const guideErrors = []
guide.on('console', message => { if (message.type() === 'error') guideErrors.push(message.text()) })
await guide.emulateMedia({ reducedMotion: 'reduce' })
await guide.goto('http://127.0.0.1:5173/?lang=zh', { waitUntil: 'networkidle' })
await guide.waitForTimeout(600)
await guide.screenshot({ path: `${out}/14-google-touch-app-visible-390x844.png` })
console.log(JSON.stringify({ name: 'touch-app-visible', errors: guideErrors }))
await guide.close()

const exit = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const exitErrors = []
exit.on('console', message => { if (message.type() === 'error') exitErrors.push(message.text()) })
await exit.goto('http://127.0.0.1:5173/?qaLevel=18&qaSpeed=5&lang=zh', { waitUntil: 'networkidle' })
await exit.waitForTimeout(19000)
await exit.screenshot({ path: `${out}/15-all-exit-queued-390x844.png` })
console.log(JSON.stringify({ name: 'all-exit-queued', errors: exitErrors }))
await exit.close()

await browser.close()
