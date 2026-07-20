import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const out = '_qa/ui/onboarding-leaderboard-v1'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function outsideCapture(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  const rankRequests = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().includes('/rank/score/')) rankRequests.push(request.url()) })
  await page.goto('http://127.0.0.1:5173/?lang=zh', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('.got-gesture__finger')).opacity) > 0.7)
  await page.screenshot({ path: `${out}/guide-${width}x${height}.png` })
  const mission = await page.getByText('任务：走到车厢门口下地铁').isVisible()
  const finger = await page.locator('.got-gesture__finger').isVisible()
  await page.getByRole('button', { name: '暂停' }).dispatchEvent('pointerdown')
  const championFallback = await page.getByRole('button', { name: '最高分榜' }).textContent()
  await page.getByRole('button', { name: '最高分榜' }).dispatchEvent('pointerdown')
  await page.waitForTimeout(120)
  const cta = await page.getByRole('link', { name: '下载 AlterU' }).isVisible()
  await page.screenshot({ path: `${out}/outside-board-${width}x${height}.png` })
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (!mission || !finger) throw new Error('Onboarding mission or ghost finger missing')
  if (!cta) throw new Error('Outside-AlterU CTA missing')
  if (rankRequests.length) throw new Error(`Outside-AlterU rank requests: ${rankRequests.join(',')}`)
  if (metrics.scrollWidth !== metrics.width) throw new Error(`Horizontal overflow: ${JSON.stringify(metrics)}`)
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ outside: true, mission, finger, championFallback, cta, rankRequests, metrics, errors }))
  await page.close()
}

async function platformCapture() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const state = { savedScores: [], events: [], profileOpens: [], myScore: 100 }
    window.__leaderboardMock = state
    const encode = value => btoa(unescape(encodeURIComponent(value)))
    const decode = value => decodeURIComponent(escape(atob(value)))
    const rankRows = () => [
      { user_id: 'champ', user_name: '冠军 Alex', head_url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22%3E%3Ccircle cx=%2222%22 cy=%2222%22 r=%2222%22 fill=%22%23ffce2e%22/%3E%3C/svg%3E', score: '300', rank: 1 },
      { user_id: 'rival', user_name: '对手 Mina', head_url: '', score: '120', rank: 2 },
      { user_id: 'me', user_name: '测试玩家', head_url: '', score: String(state.myScore), rank: 3 },
    ].sort((a, b) => Number(b.score) - Number(a.score)).map((row, index) => ({ ...row, rank: index + 1 }))
    window.webkit = { messageHandlers: { aigram: { postMessage(message) {
      if (message.startsWith('AW.PROFILE.OPEN-')) {
        state.profileOpens.push(JSON.parse(atob(message.slice('AW.PROFILE.OPEN-'.length))).id)
        return
      }
      if (!message.startsWith('callAPI-')) return
      const request = JSON.parse(decode(message.slice('callAPI-'.length)))
      let data = { retcode: 0, msg: 'ok', data: null }
      if (request.url.includes('/user/get/info/')) data = { retcode: 0, msg: 'ok', data: { telegram_id: 'me', name: '测试玩家', head_url: '' } }
      else if (request.url.includes('/rank/score/list/')) data = { retcode: 0, msg: 'ok', data: rankRows() }
      else if (request.url.includes('/rank/score/save')) { state.savedScores.push(request.data.score); state.myScore = Math.max(state.myScore, Number(request.data.score)) }
      else if (request.url.includes('/record/play')) state.events.push(request.data)
      const callback = window[`__aigram_cb_${request.request_id.replaceAll('-', '_')}`]
      if (callback) setTimeout(() => callback(JSON.stringify({ request_id: request.request_id, success: true, data })), 0)
    } } } }
  })
  await page.goto('http://127.0.0.1:5173/?lang=zh&qaScore=165&qaFailAfter=0.8&api_origin=https%3A%2F%2Faigram.aiwaves.tech&telegram_id=me', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${out}/platform-result-debug-390x844.png` })
  console.log(JSON.stringify({ platformPhaseText: await page.locator('body').innerText() }))
  const championText = await page.getByRole('button', { name: '最高分榜' }).textContent()
  await page.getByRole('button', { name: '最高分榜' }).dispatchEvent('pointerdown')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${out}/platform-board-390x844.png` })
  const meRow = page.locator('.got-lb__row--me')
  const rivalRow = page.getByRole('button', { name: /打开主页 对手 Mina/ })
  await rivalRow.click()
  const mock = await page.evaluate(() => window.__leaderboardMock)
  const notifyEvents = mock.events.filter(event => event.event === 'score_beat')
  const notifyConfig = notifyEvents[0] ? JSON.parse(notifyEvents[0].config_json) : null
  if (!championText?.includes('冠军 Alex') || !championText.includes('300')) throw new Error(`Champion mismatch: ${championText}`)
  if (await meRow.count() !== 1) throw new Error('Self row missing')
  if (mock.profileOpens.join(',') !== 'rival') throw new Error(`Profile opens mismatch: ${mock.profileOpens}`)
  if (mock.savedScores.length !== 1 || mock.savedScores[0] !== 165) throw new Error(`Score submission mismatch: ${JSON.stringify(mock.savedScores)}`)
  if (notifyEvents.length !== 1 || notifyConfig?.actions?.length !== 1 || notifyConfig.actions[0].target_user_id !== 'rival') throw new Error(`Notify mismatch: ${JSON.stringify(notifyConfig)}`)
  if (notifyConfig.actions[0].image?.ref_url !== 'https://yinxinghuan.github.io/games/posters/get-off-the-train.png') throw new Error('Notify poster mismatch')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ platform: true, championText, mock, notifyConfig, errors }))
  await page.close()
}

await outsideCapture(390, 844)
await outsideCapture(320, 568)
if (!process.argv.includes('--outside-only')) await platformCapture()
await browser.close()
