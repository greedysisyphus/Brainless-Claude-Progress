export type Lang = 'en' | 'zh-Hant' | 'zh-Hans' | 'ja'

export const LANGS: Lang[] = ['en', 'zh-Hant', 'zh-Hans', 'ja']

type Strings = {
  title: string
  opened: string
  motionOn: string
  motionOff: string
  langSet: (name: string) => string
  langUnknown: string
  barSet: { always: string; auto: string; off: string }
  barUnknown: string
  ticket: string
  noTicket: string
  doing: (what: string) => string
  thisTurn: (n: number) => string
  todoDone: (done: number, all: number) => string
  stuck: (n: number, what: string) => string
  changed: (n: number, names: string) => string
  tools: Record<string, string>
  write: string
  review: string
  verify: string
  merge: string
  justStarted: string
  minutes: (n: number) => string
  left: (n: number) => string
  failed: (n: number) => string
  allGreen: string
  loading: string
  done: string
  eta: (n: number) => string
  after: (step: string, n: number) => string
  pending: (n: number) => string
  shortPending: (n: number) => string
  short: (n: number) => string
  slow: (step: string, n: number) => string
  usually: (n: number) => string
  noHistory: (n: number) => string
  learning: string
  background: string
  running: (n: number) => string
  none: string
  yourTurn: string
  yourTurnNone: string
  stillWorking: string
  askPending: string
  idleWaiting: string
  mood: { work: string; ask: string; idle: string; fail: string; done: string }
  sep: string
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    title: 'Progress',
    opened: 'Progress pane opened.',
    motionOn: 'Progress pane: animation on.',
    motionOff: 'Progress pane: animation off.',
    langSet: n => `Progress pane language: ${n}.`,
    langUnknown: 'Languages: en, zh-Hant, zh-Hans, ja, or auto.',
    barSet: { always: 'Progress bar above the prompt: always on.', auto: 'Progress bar above the prompt: only while the pane is hidden.', off: 'Progress bar above the prompt: off.' },
    barUnknown: 'Bar: always, auto or off.',
    ticket: 'Current ticket',
    noTicket: 'No ticket recognized yet',
    doing: x => `Now: ${x}`,
    thisTurn: n => (n < 1 ? 'this turn: just started' : `this turn: ${n} min`),
    todoDone: (d, a) => `${d}/${a} done`,
    stuck: (n, x) => `Stuck: ${n} failures in a row${x ? ` (${x})` : ''}`,
    changed: (n, x) => `Changed this turn: ${n === 1 ? '1 file' : `${n} files`}: ${x}`,
    tools: { Read: 'Reading', Edit: 'Editing', Write: 'Writing', Grep: 'Searching', Glob: 'Finding files', WebSearch: 'Searching the web', WebFetch: 'Reading a page', Skill: 'Loading a skill' },
    write: 'Write',
    review: 'Review',
    verify: 'Verify',
    merge: 'Merge',
    justStarted: 'just started',
    minutes: n => `${n} min`,
    left: n => `~${n} min left`,
    failed: n => `${n} failed`,
    allGreen: 'all green',
    loading: 'loading',
    done: 'Done',
    eta: n => `Done in ~${n} min`,
    after: (x, n) => `At least ~${n} min more (no history yet for ${x})`,
    short: n => `~${n} min`,
    slow: (x, n) => `At least ~${n} min more (${x} is taking longer than usual)`,
    usually: n => `usually ~${n} min`,
    pending: n => `~${n} min of work left, once the next step starts`,
    shortPending: n => `~${n} min once next starts`,
    noHistory: n => ` (${n} step${n === 1 ? '' : 's'} without history yet)`,
    learning: 'Done in: still learning, needs a few finished runs',
    background: 'Background',
    running: n => `${n} running`,
    none: 'None',
    yourTurn: 'Your turn',
    yourTurnNone: 'Your turn: nothing',
    stillWorking: "Still working, no need to wait",
    askPending: 'A question is waiting for you',
    idleWaiting: 'Waiting for your reply',
    mood: { work: 'working', ask: 'your turn', idle: 'resting', fail: 'something broke', done: 'done' },
    sep: ', ',
  },
  'zh-Hant': {
    title: '進度',
    opened: '進度面板已打開。',
    motionOn: '進度面板：動畫已開啟。',
    motionOff: '進度面板：動畫已關閉。',
    langSet: n => `進度面板語言：${n}。`,
    langUnknown: '可用語言：en、zh-Hant、zh-Hans、ja，或 auto。',
    barSet: { always: '輸入框上方的進度列：一直顯示。', auto: '輸入框上方的進度列：面板沒顯示時才出現。', off: '輸入框上方的進度列：已關閉。' },
    barUnknown: '進度列：always、auto 或 off。',
    ticket: '目前的票',
    noTicket: '還沒認出票號',
    doing: x => `目前：${x}`,
    thisTurn: n => (n < 1 ? '這輪剛開始' : `這輪已做 ${n} 分`),
    todoDone: (d, a) => `${d}/${a} 項完成`,
    stuck: (n, x) => `卡住了：連續 ${n} 次失敗${x ? `（${x}）` : ''}`,
    changed: (n, x) => `這輪改了 ${n} 個檔案：${x}`,
    tools: { Read: '讀', Edit: '改', Write: '寫', Grep: '搜尋', Glob: '找檔案', WebSearch: '上網查', WebFetch: '讀網頁', Skill: '載入技能' },
    write: '寫程式',
    review: '審查',
    verify: '上機驗證',
    merge: '合併',
    justStarted: '剛開始',
    minutes: n => `${n} 分`,
    left: n => `約剩 ${n} 分`,
    failed: n => `${n} 項失敗`,
    allGreen: '全綠',
    loading: '讀取中',
    done: '已完成',
    eta: n => `預計完成：約 ${n} 分後`,
    after: (x, n) => `預計完成：至少還要約 ${n} 分（${x}還沒有歷史資料）`,
    short: n => `約 ${n} 分`,
    slow: (x, n) => `預計完成：至少還要約 ${n} 分（${x}比平常久）`,
    usually: n => `平常約 ${n} 分`,
    pending: n => `還要約 ${n} 分（等下一步開始）`,
    shortPending: n => `等下一步・約 ${n} 分`,
    noHistory: n => `（另有 ${n} 步還沒資料）`,
    learning: '預計完成：還在學，跑完幾張票後才算得出來',
    background: '背景工作',
    running: n => `${n} 項進行中`,
    none: '沒有',
    yourTurn: '輪到你',
    yourTurnNone: '輪到你：沒有',
    stillWorking: '我還在做，不用等我',
    askPending: '有問題等你選',
    idleWaiting: '對話在等你回覆',
    mood: { work: '我在做', ask: '等你', idle: '休息中', fail: '有東西壞了', done: '完成' },
    sep: '、',
  },
  'zh-Hans': {
    title: '进度',
    opened: '进度面板已打开。',
    motionOn: '进度面板：动画已开启。',
    motionOff: '进度面板：动画已关闭。',
    langSet: n => `进度面板语言：${n}。`,
    langUnknown: '可用语言：en、zh-Hant、zh-Hans、ja，或 auto。',
    barSet: { always: '输入框上方的进度条：一直显示。', auto: '输入框上方的进度条：面板没显示时才出现。', off: '输入框上方的进度条：已关闭。' },
    barUnknown: '进度条：always、auto 或 off。',
    ticket: '当前任务',
    noTicket: '还没识别出任务编号',
    doing: x => `当前：${x}`,
    thisTurn: n => (n < 1 ? '这轮刚开始' : `这轮已做 ${n} 分`),
    todoDone: (d, a) => `${d}/${a} 项完成`,
    stuck: (n, x) => `卡住了：连续 ${n} 次失败${x ? `（${x}）` : ''}`,
    changed: (n, x) => `这轮改了 ${n} 个文件：${x}`,
    tools: { Read: '读', Edit: '改', Write: '写', Grep: '搜索', Glob: '找文件', WebSearch: '上网查', WebFetch: '读网页', Skill: '加载技能' },
    write: '写代码',
    review: '审查',
    verify: '验证',
    merge: '合并',
    justStarted: '刚开始',
    minutes: n => `${n} 分钟`,
    left: n => `约剩 ${n} 分钟`,
    failed: n => `${n} 项失败`,
    allGreen: '全部通过',
    loading: '读取中',
    done: '已完成',
    eta: n => `预计完成：约 ${n} 分钟后`,
    after: (x, n) => `预计完成：至少还要约 ${n} 分钟（${x}还没有历史数据）`,
    short: n => `约 ${n} 分钟`,
    slow: (x, n) => `预计完成：至少还要约 ${n} 分钟（${x}比平时久）`,
    usually: n => `平时约 ${n} 分钟`,
    pending: n => `还需约 ${n} 分钟（等下一步开始）`,
    shortPending: n => `等下一步・约 ${n} 分钟`,
    noHistory: n => `（另有 ${n} 步还没有数据）`,
    learning: '预计完成：还在学习，跑完几次后才能估算',
    background: '后台任务',
    running: n => `${n} 项进行中`,
    none: '没有',
    yourTurn: '轮到你',
    yourTurnNone: '轮到你：没有',
    stillWorking: '我还在做，不用等我',
    askPending: '有问题等你选',
    idleWaiting: '对话在等你回复',
    mood: { work: '我在做', ask: '等你', idle: '休息中', fail: '出问题了', done: '完成' },
    sep: '、',
  },
  ja: {
    title: '進捗',
    opened: '進捗パネルを開きました。',
    motionOn: '進捗パネル：アニメーションをオンにしました。',
    motionOff: '進捗パネル：アニメーションをオフにしました。',
    langSet: n => `進捗パネルの言語：${n}。`,
    langUnknown: '使える言語：en、zh-Hant、zh-Hans、ja、または auto。',
    barSet: { always: '入力欄の上の進捗バー：常に表示。', auto: '入力欄の上の進捗バー：パネルが非表示のときだけ表示。', off: '入力欄の上の進捗バー：オフ。' },
    barUnknown: '進捗バー：always、auto、off のいずれか。',
    ticket: '現在のチケット',
    noTicket: 'チケット番号はまだ見つかっていません',
    doing: x => `作業中：${x}`,
    thisTurn: n => (n < 1 ? 'このターン：開始したばかり' : `このターン：${n} 分`),
    todoDone: (d, a) => `${d}/${a} 件完了`,
    stuck: (n, x) => `行き詰まり：${n} 回連続で失敗${x ? `（${x}）` : ''}`,
    changed: (n, x) => `このターンで ${n} ファイル変更：${x}`,
    tools: { Read: '読む', Edit: '編集', Write: '書く', Grep: '検索', Glob: 'ファイル検索', WebSearch: 'ウェブ検索', WebFetch: 'ページを読む', Skill: 'スキル読み込み' },
    write: '実装',
    review: 'レビュー',
    verify: '検証',
    merge: 'マージ',
    justStarted: '開始直後',
    minutes: n => `${n} 分`,
    left: n => `残り約 ${n} 分`,
    failed: n => `${n} 件失敗`,
    allGreen: 'すべて成功',
    loading: '読み込み中',
    done: '完了',
    eta: n => `完了予定：約 ${n} 分後`,
    after: (x, n) => `完了予定：少なくとも約 ${n} 分（${x}の実績はまだなし）`,
    short: n => `約 ${n} 分`,
    slow: (x, n) => `完了予定：少なくとも約 ${n} 分（${x}がいつもより長引いています）`,
    usually: n => `通常は約 ${n} 分`,
    pending: n => `残り約 ${n} 分（次のステップの開始待ち）`,
    shortPending: n => `次の開始待ち・約 ${n} 分`,
    noHistory: n => `（ほかに ${n} ステップは実績なし）`,
    learning: '完了予定：学習中。何回か完了すると見積もれます',
    background: 'バックグラウンド',
    running: n => `${n} 件実行中`,
    none: 'なし',
    yourTurn: 'あなたの番',
    yourTurnNone: 'あなたの番：なし',
    stillWorking: 'まだ作業中です。待たなくて大丈夫です',
    askPending: '質問があなたの回答を待っています',
    idleWaiting: 'あなたの返信を待っています',
    mood: { work: '作業中', ask: 'あなたの番', idle: '休憩中', fail: '問題あり', done: '完了' },
    sep: '、',
  },
}

const NAMES: Record<Lang, string> = { en: 'English', 'zh-Hant': '繁體中文', 'zh-Hans': '简体中文', ja: '日本語' }
export const langName = (l: Lang) => NAMES[l]

// A locale tag ("zh-TW", "zh_CN.UTF-8", "ja-JP") or a language's name ("Traditional Chinese", "日本語")
export function normalizeLang(raw: unknown): Lang | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const s = raw.trim().toLowerCase().replace('_', '-')
  if (/^ja\b|japanese|日本語|日文/.test(s)) return 'ja'
  if (/^zh-(hant|tw|hk|mo)\b|traditional|繁/.test(s)) return 'zh-Hant'
  if (/^zh\b|chinese|simplified|简|中文/.test(s)) return 'zh-Hans'
  if (/^en\b|english/.test(s)) return 'en'
  return undefined
}

// Characters that exist only in one script; a handful is enough to tell a sentence apart.
const SIMPLIFIED = /[这们个说时会对没还发经过问题实现进图开关单试错后从样让给门见读写设标权]/g
const TRADITIONAL = /[這們個說時會對沒還發經過問題實現進圖開關單試錯後從樣讓給門見讀寫設標權]/g

// The language a person wrote in, from their own message; undefined for too little text to tell.
export function detectLang(text: string): Lang | undefined {
  const plain = text.replace(/```[\s\S]*?```|`[^`]*`|https?:\S+/g, '')
  if (/[぀-ヿ]/.test(plain)) return 'ja'
  const han = plain.match(/[一-鿿]/g)?.length ?? 0
  const latin = plain.match(/[A-Za-z]/g)?.length ?? 0
  if (han >= 2 && han * 3 >= latin) {
    const simp = plain.match(SIMPLIFIED)?.length ?? 0
    const trad = plain.match(TRADITIONAL)?.length ?? 0
    return simp > trad ? 'zh-Hans' : 'zh-Hant'
  }
  if (latin >= 12) return 'en'
  return undefined
}

// Headings a reply uses when it hands something back to the person: a decision outranks
// a request to go and look, whichever comes first in the reply.
const DECIDE_HEADS = [
  'decision needed', 'decisions needed', 'needs your decision', 'your decision', 'your call', 'waiting on you',
  '要你決定', '需要你決定', '請你決定', '要你决定', '需要你决定', '请你决定',
  '要判断', 'ご判断ください', '判断してほしいこと', '決めてほしいこと',
]
const CHECK_HEADS = [
  'action needed', 'action required', 'please check', 'please verify', 'please review',
  '請你親眼看', '待你確認', '請確認', '请你亲眼看', '待你确认', '请确认',
  '確認してください', '要確認',
]
const ASK_HEADS = [...DECIDE_HEADS, ...CHECK_HEADS]
const STOP = /^(結論|结论|下一步|未執行|未执行|next steps?|summary|not run|结論|次のステップ|まとめ|未実施)\b/i

const strip = (l: string) => l.replace(/^[\s>*#_\-•]+/, '').replace(/[*_]+/g, '').trim()

// What a reply leaves waiting on the person: a decision heading's block, else a closing question.
export function askOf(answer: string, max = 140): string {
  const text = answer.replace(/```[\s\S]*?```/g, '')
  const lines = text.split('\n')
  for (const heads of [DECIDE_HEADS, CHECK_HEADS]) for (let i = 0; i < lines.length; i++) {
    const line = strip(lines[i]!)
    const head = heads.find(h => line.toLowerCase().startsWith(h))
    if (!head) continue
    const first = line.slice(head.length).replace(/^[\s:：]+/, '')
    const rest: string[] = []
    for (const l of lines.slice(i + 1)) {
      const s = strip(l)
      if (!s || STOP.test(s) || ASK_HEADS.some(h => s.toLowerCase().startsWith(h))) break
      rest.push(s.replace(/^\d+[.)、]\s*/, ''))
    }
    const found = [first, ...rest].filter(Boolean).join(' / ')
    if (found) return cut(found, max)
  }
  // no heading: a reply that ends on a question is waiting for an answer
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p && !/^(sources?|來源|来源|出典)\s*[:：]/i.test(p))
  const last = paras[paras.length - 1] ?? ''
  if (/[?？]\s*$/.test(last)) {
    const sentences = last.replace(/\n/g, ' ').split(/(?<=[.!?。！？])\s*/).filter(Boolean)
    return cut(strip(sentences[sentences.length - 1] ?? last), max)
  }
  return ''
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
