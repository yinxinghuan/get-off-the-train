export type Locale = 'zh' | 'en'

function detectLocale(): Locale {
  const query = new URLSearchParams(location.search).get('lang')
  if (query === 'en' || query === 'zh') return query
  const override = localStorage.getItem('game_locale')
  if (override === 'en' || override === 'zh') return override
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const locale = detectLocale()

const zh = {
  title: '挤下地铁', kicker: '早高峰 · 物理逃脱', strap: '车门要关了！',
  intro: '穿过人群，在关门前挤到酸黄色出口。看到吊环摆动，松手站稳。',
  start: '开始挤', level: '车厢', time: '关门', distance: '离门', falls: '摔倒',
  meters: '米', brace: '站稳了', warning: '要晃了！', left: '向左倒', right: '向右倒',
  pause: '暂停', resume: '继续挤', restart: '重新开始整局', quit: '返回首页',
  clear: '挤出来了！', clearCopy: '门在身后关上，差一点点。', next: '下一节车厢',
  miss: '错过站！', missCopy: '车门关上了。今天的考勤要解释一下。', retry: '再挤一次',
  remaining: '剩余时间', levelScore: '本关得分', totalScore: '总分', best: '最高',
  tutorialMove: '拖动摇杆，冲向出口', tutorialBrace: '吊环摆动时松手站稳',
  reduced: '减弱动态', sound: '声音', mute: '静音',
  leaderboard: '最高分榜', rankRule: '整局累计分 · 只保留个人最高', board: '排行榜',
  you: '你', yourRun: '你的纪录', openProfile: '打开主页', close: '关闭', loading: '正在读取车厢记录',
  openAlterU: '在 AlterU 中打开即可查看真实排行榜', getAlterU: '下载 AlterU', emptyRank: '还没人挤到这里，等你上榜',
  endless: '无限关卡', bestRunner: '当前第一',
}

const en: typeof zh = {
  title: 'GET OFF!', kicker: 'RUSH HOUR · PHYSICS ESCAPE', strap: 'DOORS CLOSING!',
  intro: 'Push through the crowd and reach the acid-yellow exit. When the straps swing, release to brace.',
  start: 'PUSH THROUGH', level: 'CAR', time: 'DOORS', distance: 'TO EXIT', falls: 'FALLS',
  meters: 'm', brace: 'BRACED', warning: 'TRAIN SWAY!', left: 'FALLING LEFT', right: 'FALLING RIGHT',
  pause: 'PAUSED', resume: 'KEEP PUSHING', restart: 'RESTART RUN', quit: 'BACK TO COVER',
  clear: 'MADE IT!', clearCopy: 'The doors snapped shut right behind you.', next: 'NEXT CAR',
  miss: 'MISSED IT!', missCopy: 'The doors closed. Your attendance needs a story.', retry: 'TRY AGAIN',
  remaining: 'TIME LEFT', levelScore: 'CAR SCORE', totalScore: 'TOTAL', best: 'BEST',
  tutorialMove: 'Drag the stick toward the exit', tutorialBrace: 'Release when the straps swing',
  reduced: 'REDUCE MOTION', sound: 'SOUND', mute: 'MUTED',
  leaderboard: 'HIGH SCORE', rankRule: 'RUN TOTAL · PERSONAL BEST ONLY', board: 'LEADERBOARD',
  you: 'YOU', yourRun: 'YOUR RECORD', openProfile: 'OPEN PROFILE', close: 'CLOSE', loading: 'READING CAR RECORDS',
  openAlterU: 'Open in AlterU to view the live leaderboard.', getAlterU: 'GET ALTERU', emptyRank: 'No one made it this far. Be first.',
  endless: 'ENDLESS CARS', bestRunner: 'CURRENT #1',
}

const dict = locale === 'zh' ? zh : en
export function t(key: keyof typeof zh) { return dict[key] }
