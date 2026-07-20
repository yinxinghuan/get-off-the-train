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
  level: '车厢', time: '关门', distance: '距门', falls: '摔倒',
  meters: '米', brace: '站稳了', warning: '要晃了！', left: '向左倒', right: '向右倒',
  pause: '暂停', resume: '继续挤', restart: '重新开始整局',
  clear: '挤出来了！', clearCopy: '门在身后关上，差一点点。', next: '下一节车厢',
  miss: '错过站！', missCopy: '车门关上了。今天的考勤要解释一下。', retry: '再挤一次',
  remaining: '剩余时间', levelScore: '本关得分', totalScore: '总分', best: '最高',
  tutorialMove: '拖动摇杆，冲向出口', tutorialBrace: '吊环摆动时松手站稳',
  reduced: '减弱动态',
  leaderboard: '最高分榜', rankRule: '整局累计分 · 只保留个人最高', board: '排行榜',
  you: '你', yourRun: '你的纪录', openProfile: '打开主页', close: '关闭', loading: '正在读取车厢记录',
  openAlterU: '在 AlterU 中打开即可查看真实排行榜', getAlterU: '下载 AlterU', emptyRank: '还没人挤到这里，等你上榜',
  dragUp: '任意位置拖动移动', exitAhead: '出口',
  collection: '角色收藏', coins: '金币', coinReward: '本关金币', equipped: '使用中', equip: '装备', unlock: '解锁角色',
  locked: '未解锁', owned: '已拥有', needCoins: '还差金币', closeCollection: '关闭角色收藏', collectionHint: '换个身份继续挤地铁',
  human: '人物', monster: '怪物', animal: '动物', special: '特殊角色', saving: '正在读取收藏',
  previousHero: '上一个角色', nextHero: '下一个角色',
}

const en: typeof zh = {
  level: 'CAR', time: 'DOORS', distance: 'TO EXIT', falls: 'FALLS',
  meters: 'm', brace: 'BRACED', warning: 'TRAIN SWAY!', left: 'FALLING LEFT', right: 'FALLING RIGHT',
  pause: 'PAUSED', resume: 'KEEP PUSHING', restart: 'RESTART RUN',
  clear: 'MADE IT!', clearCopy: 'The doors snapped shut right behind you.', next: 'NEXT CAR',
  miss: 'MISSED IT!', missCopy: 'The doors closed. Your attendance needs a story.', retry: 'TRY AGAIN',
  remaining: 'TIME LEFT', levelScore: 'CAR SCORE', totalScore: 'TOTAL', best: 'BEST',
  tutorialMove: 'Drag the stick toward the exit', tutorialBrace: 'Release when the straps swing',
  reduced: 'REDUCE MOTION',
  leaderboard: 'HIGH SCORE', rankRule: 'RUN TOTAL · PERSONAL BEST ONLY', board: 'LEADERBOARD',
  you: 'YOU', yourRun: 'YOUR RECORD', openProfile: 'OPEN PROFILE', close: 'CLOSE', loading: 'READING CAR RECORDS',
  openAlterU: 'Open in AlterU to view the live leaderboard.', getAlterU: 'GET ALTERU', emptyRank: 'No one made it this far. Be first.',
  dragUp: 'DRAG ANYWHERE TO MOVE', exitAhead: 'EXIT',
  collection: 'HEROES', coins: 'COINS', coinReward: 'CAR COINS', equipped: 'EQUIPPED', equip: 'EQUIP', unlock: 'UNLOCK',
  locked: 'LOCKED', owned: 'OWNED', needCoins: 'COINS NEEDED', closeCollection: 'CLOSE COLLECTION', collectionHint: 'Pick a new commuter for the next car.',
  human: 'HUMAN', monster: 'MONSTER', animal: 'ANIMAL', special: 'SPECIAL', saving: 'LOADING COLLECTION',
  previousHero: 'PREVIOUS CHARACTER', nextHero: 'NEXT CHARACTER',
}

const dict = locale === 'zh' ? zh : en
export function t(key: keyof typeof zh) { return dict[key] }

const heroNames = {
  zh: {
    commuter: '赶班族', shopkeeper: '店员', granny: '奶奶', oldman: '老先生', blonde: '金发女士', kid: '小学生', businessman: '商务主管', officeWoman: '办公室职员', student: '学生', darkWoman: '都市女士', worker: '工人', teen: '少年', fitWoman: '健身达人', chef: '厨师', bigGuy: '壮汉',
    cop: '警察', nurse: '护士', firefighter: '消防员', construction: '建筑工', delivery: '报童', cowboy: '牛仔', punk: '朋克', rapper: '说唱歌手', biker: '机车客', goth: '哥特女士', executive: '高管', courier: '快递员', janitor: '清洁工', barista: '咖啡师', securityGuard: '保安', swat: '特警', viking: '维京战士', combatMech: '战斗机器人', minotaur: '牛头战士', paramedic: '急救员',
    vampire: '吸血鬼', werewolf: '狼人', zombie: '僵尸', ghost: '幽灵', skeleton: '骷髅', mummy: '木乃伊',
    pig: '小猪', cow: '奶牛', cat: '地铁猫', fox: '狐狸', chicken: '小鸡', frog: '青蛙', dog: '通勤犬', sheep: '绵羊', rabbit: '兔子', bear: '棕熊', duck: '鸭子',
  },
  en: {
    commuter: 'COMMUTER', shopkeeper: 'SHOPKEEPER', granny: 'GRANNY', oldman: 'OLD MAN', blonde: 'BLONDE', kid: 'KID', businessman: 'BUSINESSMAN', officeWoman: 'OFFICE WOMAN', student: 'STUDENT', darkWoman: 'CITY WOMAN', worker: 'WORKER', teen: 'TEEN', fitWoman: 'FIT WOMAN', chef: 'CHEF', bigGuy: 'BIG GUY',
    cop: 'COP', nurse: 'NURSE', firefighter: 'FIREFIGHTER', construction: 'CONSTRUCTION', delivery: 'NEWSIE', cowboy: 'COWBOY', punk: 'PUNK', rapper: 'RAPPER', biker: 'BIKER', goth: 'GOTH', executive: 'EXECUTIVE', courier: 'COURIER', janitor: 'JANITOR', barista: 'BARISTA', securityGuard: 'SECURITY', swat: 'SWAT', viking: 'VIKING', combatMech: 'COMBAT MECH', minotaur: 'MINOTAUR', paramedic: 'PARAMEDIC',
    vampire: 'VAMPIRE', werewolf: 'WEREWOLF', zombie: 'ZOMBIE', ghost: 'GHOST', skeleton: 'SKELETON', mummy: 'MUMMY',
    pig: 'PIG', cow: 'COW', cat: 'METRO CAT', fox: 'FOX', chicken: 'CHICKEN', frog: 'FROG', dog: 'COMMUTER DOG', sheep: 'SHEEP', rabbit: 'RABBIT', bear: 'BEAR', duck: 'DUCK',
  },
} as const

export type HeroNameId = keyof typeof heroNames.zh
export function heroName(id: HeroNameId) { return heroNames[locale][id] }
