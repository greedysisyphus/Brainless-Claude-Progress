import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { BgTask, CheckRun, LangPick, PrWatch, Stage, Turn } from '../types'
import { askOf, detectLang, type Lang, langName, normalizeLang, STRINGS } from './i18n'

const PANE = 'progress'
const bg = atom({ plugin: 'brainless-claude-progress', key: 'bg' } as const, [] as BgTask[])
const prs = atom({ plugin: 'brainless-claude-progress', key: 'prs' } as const, [] as PrWatch[])
const turn = atom({ plugin: 'brainless-claude-progress', key: 'turn' } as const, 'idle' as Turn)
const now = atom({ plugin: 'brainless-claude-progress', key: 'now' } as const, 0)
const ask = atom({ plugin: 'brainless-claude-progress', key: 'ask' } as const, '')
const ticket = atom({ plugin: 'brainless-claude-progress', key: 'ticket' } as const, '')
const frame = atom({ plugin: 'brainless-claude-progress', key: 'frame' } as const, 0)
const quiet = atom({ plugin: 'brainless-claude-progress', key: 'still' } as const, false)
const langPick = atom({ plugin: 'brainless-claude-progress', key: 'langPick' } as const, '' as LangPick)
const langAuto = atom({ plugin: 'brainless-claude-progress', key: 'langAuto' } as const, '' as LangPick)
const repoNow = atom({ plugin: 'brainless-claude-progress', key: 'repo' } as const, '')
// the languages of the person's last ten messages: one short line in another language does not tip it
const said = atom({ plugin: 'brainless-claude-progress', key: 'said' } as const, [] as Lang[])
const barMode = atom({ plugin: 'brainless-claude-progress', key: 'bar' } as const, 'always' as 'always' | 'auto' | 'off')

// ponytail: module flag the drawing sets and the frame timer reads; a reload resets it to off until the next draw
let motion = false
// Claude's own spark, breathing in and out
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']

type Mood = 'work' | 'ask' | 'idle' | 'fail' | 'done'
// a 7-column spark; every line the same width so the card never shifts between frames
export function sparkFor(mood: Mood, f: number): string[] {
  const core = SPIN[f % SPIN.length]!
  switch (mood) {
    // rays turn a quarter each frame while the core breathes
    case 'work': return f % 2 ? [' \\   / ', `   ${core}   `, ' /   \\ '] : ['   │   ', ` ─ ${core} ─ `, '   │   ']
    case 'ask': return ['   │   ', ' ─ ✻ ─ ', '   │   ']
    case 'idle': return ['       ', '   ·   ', '       ']
    case 'fail': return ['       ', '   ✕   ', '       ']
    case 'done': return [' \\ │ / ', ' ─ ✻ ─ ', ' / │ \\ ']
    default: { const never: never = mood; return never }
  }
}

const PR_REF = /gh pr (?:view|checks|merge|edit|comment|ready)\s+(\d+)|\/pull\/(\d+)/
const PR_URL = /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/
const REPO_FLAG = /(?:-R|--repo)\s+([\w.-]+\/[\w.-]+)/
const CD = /^\s*cd\s+("([^"]+)"|'([^']+)'|(\S+))/

// Jira-style keys, minus the uppercase-dash-number words that are not tickets
const KEY = /\b([A-Z][A-Z0-9]{1,9}-\d{1,6})\b/
const NOT_KEY = /^(UTF|SHA|ISO|RFC|HTTP|TLS|SSL|IPV|MP|H|X|ES|ECMA|WCAG|PEP|GPL|LGPL|CC|BY|CVE)-/

// "#123" or "ABC-123" in a task's own name
export function ticketOfName(s: string): string | undefined {
  const num = s.match(/#(\d{1,6})\b/)
  if (num) return `#${num[1]}`
  const key = s.match(KEY)?.[1]
  return key && !NOT_KEY.test(key) ? key : undefined
}

// "…/123-slug" or "…/ABC-123-slug": the ticket a worktree folder or a branch is named for
function ticketOfRef(ref: string): string | undefined {
  const num = ref.match(/(?:^|[/_])(\d{2,6})-[a-z]/i)
  if (num) return `#${num[1]}`
  const key = ref.match(/(?:^|[/_])([A-Z][A-Z0-9]{1,9}-\d{1,6})(?=$|[-_/])/)?.[1]
  return key && !NOT_KEY.test(key) ? key : undefined
}

// The ticket a shell command works on: only where the command says so (the folder it enters,
// a branch it makes or pushes, an issue it develops), never a number that merely appears in its text.
// A command with no description, shown by what it does: past any `cd …&&` and `NAME=value` it opens with.
export function labelOf(cmd: string): string {
  let rest = cmd.trim()
  for (;;) {
    const next = rest
      .replace(/^cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*/, '')
      .replace(/^[A-Za-z_][A-Za-z0-9_]*=("[^"]*"|'[^']*'|\S*)\s*(;|&&)?\s*/, '')
    if (next === rest) break
    rest = next
  }
  const line = (rest || cmd).split('\n')[0]!.trim()
  return line.length > 40 ? line.slice(0, 39) + '…' : line
}

// The folder a command cds into, when that folder's name is what names its ticket.
export function ticketDirOf(cmd: string): string | undefined {
  const cd = cmd.match(CD)
  const dir = cd && (cd[2] ?? cd[3] ?? cd[4])
  return dir && ticketOfRef(dir) ? dir : undefined
}

// A folder named like a ticket counts only inside a git work tree named for the same ticket:
// a scratch folder such as ".../128-shots" names nothing.
async function isTicketTree($: any, dir: string, t: string): Promise<boolean> {
  const run = await $.process.run(['git', '-C', dir, 'rev-parse', '--show-toplevel'], { timeoutMs: 5000 }).catch(() => undefined)
  return run?.exitCode === 0 && ticketOfRef(String(run.stdout).trim()) === t
}

export function ticketOfCommand(cmd: string): string | undefined {
  const cd = cmd.match(CD)
  const dir = cd && (cd[2] ?? cd[3] ?? cd[4])
  if (dir) {
    const t = ticketOfRef(dir)
    if (t) return t
  }
  const branch = cmd.match(/\bgit\s+(?:checkout\s+-[bB]|switch\s+-[cC]|worktree\s+add\s+\S+\s+-b|push\s+(?:-u\s+)?\S+)\s+("[^"]+"|\S+)/)?.[1]
  if (branch) {
    const t = ticketOfRef(branch.replace(/"/g, '').replace(/^HEAD:/, ''))
    if (t) return t
  }
  const wt = cmd.match(/\bgit\s+worktree\s+add\s+("[^"]+"|\S+)/)?.[1]
  if (wt) {
    const t = ticketOfRef(wt.replace(/"/g, ''))
    if (t) return t
  }
  // reading, commenting on or closing an issue is not starting it; making its branch is
  const issue = cmd.match(/\bgh\s+issue\s+develop\s+(\d+)/)?.[1]
  return issue ? `#${issue}` : undefined
}

// ponytail: keyword match on the task's own words, four languages; a task named otherwise lands in 'other'
export const stageOf = (s: string): Stage =>
  // a task that only waits on something else does no step's work and must not time one
  /^\s*(wait(ing)? (for|on|until)|poll|watch)\b|^\s*(等待|等到|等)|^\s*(待つ|待機)/i.test(s) ? 'other'
    : /review|審查|审查|レビュー|審閱|审阅|codex/i.test(s) ? 'review'
    : /verif|device|\bqa\b|\btest|e2e|simulator|\bci\b|ci:local|typecheck|type-check|\btsc\b|\blint|驗證|验证|驗機|上機|上机|測試|测试|検証|確認|テスト/i.test(s) ? 'verify'
    : /writ|implement|\bfix|build|refactor|寫|写|修|實作|实现|実装|修正/i.test(s) ? 'write' : 'other'

const STAGES: Stage[] = ['write', 'review', 'verify']

const mins = (ms: number) => Math.max(0, Math.round(ms / 60000))
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

async function learn($: any, key: string, ms: number) {
  const past: number[] = (await $.store.get(`dur:${key}`)) ?? []
  await $.store.set(`dur:${key}`, [...past, ms].slice(-10))
}

async function past($: any, key: string): Promise<number[]> {
  return ((await $.store.get(`dur:${key}`)) ?? []) as number[]
}

const ciKey = (repo: string | undefined, name: string) => `ci:${repo || '?'}:${name}`

// each repository keeps its own step times; one with none yet borrows the shared record from before 1.5.0
async function stagePast($: any, repo: string, stage: Stage): Promise<number[]> {
  const own = await past($, `stage:${repo || '?'}:${stage}`)
  return own.length ? own : past($, `stage:${stage}`)
}

// a task that ended: mark it, and remember how long its kind of step took
async function finish($: any, id: string, status?: string) {
  const x = (await read($, bg)).find(y => y.id === id && !y.doneAt)
  if (!x) return
  const end = await $.clock.now()
  await update($, bg, all => all.map(y => (y.id === id && !y.doneAt ? { ...y, doneAt: end, status } : y)))
  if (x.startedAt && x.stage !== 'other' && (!status || status === 'completed')) await learn($, `stage:${(await read($, repoNow)) || '?'}:${x.stage}`, end - x.startedAt)
}

// A PR this session opened belongs to the ticket at hand; one it only looks at belongs to whatever
// its own branch or title names, which the next poll reads.
async function watchPr($: any, number: number, repo: string | undefined, cwd: string, isOpenedHere: boolean) {
  const t = isOpenedHere ? (await read($, ticket)) || undefined : undefined
  await update($, prs, all =>
    all.some(p => p.number === number && (!repo || !p.repo || p.repo === repo))
      ? all
      : [...all, { number, repo, cwd, ticket: t, checks: [] }].slice(-3),
  )
}

// the ticket a PR names in its branch or its title
export const ticketOfPr = (branch: string, title: string) => ticketOfRef(`/${branch}`) ?? ticketOfName(title)

// A PR's rollup keeps every run of its head commit (a red preflight before the full one):
// only the newest run of each check counts.
export function latestRuns(roll: any[]): any[] {
  const last = new Map<string, any>()
  for (const c of roll) {
    const name = c.name ?? c.context ?? '?'
    const prev = last.get(name)
    if (!prev || (c.startedAt ?? '') > (prev.startedAt ?? '')) last.set(name, c)
  }
  return [...last.values()]
}

// wall-clock of one finished CI pass: first start to last end of the newest runs
export function ciTotal(roll: any[]): number {
  const runs = latestRuns(roll).filter(c => c.startedAt && c.completedAt && !String(c.completedAt).startsWith('0001'))
  if (!runs.length) return 0
  return Math.max(...runs.map(c => Date.parse(c.completedAt))) - Math.min(...runs.map(c => Date.parse(c.startedAt)))
}

async function repoOf($: any, cwd: string): Promise<string> {
  const run = await $.process.run(['gh', 'repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { cwd, timeoutMs: 15000 }).catch(() => undefined)
  return run?.exitCode === 0 ? run.stdout.trim() : ''
}

// Each repository's CI history, read once from its last merged PRs, so the first ticket has an estimate.
async function seedCi($: any, cwd: string, repo: string) {
  if (!repo || (await $.store.get(`seeded:${repo}`))) return
  const run = await $.process.run(
    ['gh', 'pr', 'list', '-R', repo, '--state', 'merged', '--limit', '10', '--json', 'statusCheckRollup'],
    { cwd, timeoutMs: 30000 },
  ).catch(() => undefined)
  if (!run || run.exitCode !== 0) return
  const totals: number[] = []
  const byName = new Map<string, number[]>()
  for (const pr of JSON.parse(run.stdout) as any[]) {
    const roll = pr.statusCheckRollup ?? []
    const total = ciTotal(roll)
    if (total > 0) totals.push(total)
    for (const c of latestRuns(roll)) {
      const ms = Date.parse(c.completedAt) - Date.parse(c.startedAt)
      if (c.conclusion === 'SUCCESS' && ms > 0) byName.set(c.name, [...(byName.get(c.name) ?? []), ms])
    }
  }
  if (totals.length) await $.store.set(`dur:${ciKey(repo, 'total')}`, totals.slice(0, 10))
  for (const [name, list] of byName) await $.store.set(`dur:${ciKey(repo, name)}`, list.slice(0, 10))
  await $.store.set(`seeded:${repo}`, true)
}

// Each check's state. A failure that ended before a check of a newer run started belongs
// to the run before: until its own re-run appears it counts as pending, not failed.
export function checksOf(roll: any[]): CheckRun[] {
  const raw = roll.map((c: any) => {
    const done = c.status === 'COMPLETED' || c.state === 'SUCCESS' || c.state === 'FAILURE' || c.state === 'ERROR'
    const ok = c.conclusion === 'SUCCESS' || c.conclusion === 'SKIPPED' || c.conclusion === 'NEUTRAL' || c.state === 'SUCCESS'
    return {
      name: c.name ?? c.context ?? '?',
      state: (!done ? 'pending' : ok ? 'pass' : 'fail') as CheckRun['state'],
      startedAt: c.startedAt ? Date.parse(c.startedAt) : undefined,
      endedAt: done && c.completedAt && !String(c.completedAt).startsWith('0001') ? Date.parse(c.completedAt) : undefined,
    }
  })
  const newRun = Math.max(0, ...raw.filter(c => c.state === 'pending').map(c => c.startedAt ?? 0))
  return raw.map(({ endedAt, ...c }) => (c.state === 'fail' && endedAt && endedAt < newRun ? { ...c, state: 'pending' } : c))
}

async function poll($: any) {
  // a subagent whose notification we missed still ends: settle it from the engine's list
  const agents = ((await $.agent.list().catch(() => [])) as any[])
  const ended = new Map(agents.filter(a => !['running', 'pending', 'waiting'].includes(a.status)).map(a => [a.id, a.status]))
  for (const x of await read($, bg)) if (x.kind === 'agent' && !x.doneAt && ended.has(x.id)) await finish($, x.id, ended.get(x.id))

  for (const pr of await read($, prs)) {
    // a finished PR is read once more if its branch was never read (a record from before 1.3.2)
    if ((pr.state === 'MERGED' || pr.state === 'CLOSED') && pr.branch !== undefined) continue
    const argv = ['gh', 'pr', 'view', String(pr.number), '--json', 'title,state,url,headRefName,statusCheckRollup']
    if (pr.repo) argv.push('-R', pr.repo)
    const run = await $.process.run(argv, { cwd: pr.cwd, timeoutMs: 20000 }).catch(() => undefined)
    if (!run || run.exitCode !== 0) continue
    const j = JSON.parse(run.stdout)
    const repo = pr.repo ?? String(j.url ?? '').match(PR_URL)?.[1]
    if (repo) await seedCi($, pr.cwd, repo)
    const roll = latestRuns(j.statusCheckRollup ?? [])
    const checks = checksOf(roll)
    for (const c of roll) {
      const before = pr.checks.find(x => x.name === (c.name ?? c.context))
      if (before?.state === 'pending' && c.status === 'COMPLETED' && c.startedAt && c.completedAt)
        await learn($, ciKey(repo, c.name), Date.parse(c.completedAt) - Date.parse(c.startedAt))
    }
    if (pr.checks.some(c => c.state === 'pending') && checks.length && checks.every(c => c.state !== 'pending')) {
      const total = ciTotal(roll)
      if (total > 0) await learn($, ciKey(repo, 'total'), total)
    }
    const polledAt = await $.clock.now()
    await update($, prs, all =>
      all.map(p => (p.number === pr.number && p.cwd === pr.cwd
        ? { ...p, repo, branch: j.headRefName, ticket: ticketOfPr(String(j.headRefName ?? ''), String(j.title ?? '')) ?? p.ticket, title: j.title, state: j.state, checks, polledAt: polledAt } : p)),
    )
  }
}

// the most frequent; a tie goes to the most recent
export function mostOf(langs: Lang[]): Lang | undefined {
  const count = new Map<Lang, number>()
  for (const l of langs) count.set(l, (count.get(l) ?? 0) + 1)
  let best: Lang | undefined
  for (const l of [...langs].reverse()) if (!best || count.get(l)! > count.get(best)!) best = l
  return best
}

// Words the person typed, here or through Remote Control. Told apart by what is NOT a person,
// since builds name the person's own origin differently ('composer', 'human', ...).
const NOT_PERSON = new Set([
  'task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'channel',
  'coordinator', 'observer', 'observer-activity', 'auto-continuation', 'slack-ping', 'sdk', 'unclassified',
])
export const isPerson = (e: any) => !e.isMeta && !e.command && !NOT_PERSON.has(String(e.origin?.kind ?? ''))

async function langNow($: any): Promise<Lang> {
  return ((await read($, langPick)) || (await read($, langAuto)) || 'en') as Lang
}

type Mark = 'done' | 'run' | 'fail' | 'none' | 'skip'
type Step = { name: string; mark: Mark; note: string; isCi?: boolean }

// Everything the pane and the status line show, worked out once from the state.
async function viewOf($: any) {
  await read($, now) // subscribes the drawing to the minute tick
  // the engine's clock: the wall clock in a session, a controllable one under test
  const t = await $.clock.now()
  const s = STRINGS[await langNow($)]
  const tasks = await read($, bg)
  const watched = await read($, prs)
  const who = await read($, turn)
  const waiting = await read($, ask)
  const frame_ = await read($, frame)
  const still = await read($, quiet)
  const sessionRepo = await read($, repoNow)
  const ago = (ms: number, from = 1) => (!from ? '' : ms < 60000 ? s.justStarted : s.minutes(Math.round(ms / 60000)))

  // agents spawned before this load, or not through the Agent tool, are known only to the engine
  const agents = ((await $.agent.list().catch(() => [])) as any[])
    .filter(a => ['running', 'pending', 'waiting'].includes(a.status) && !tasks.some(x => x.id === a.id))
    .map((a): BgTask => ({ id: a.id, label: a.description, kind: 'agent', stage: stageOf(a.description), ticket: ticketOfName(a.description), startedAt: 0 }))
  // filed by today's rules, so a task recorded before an update or a reload is not stuck under an old step
  const all = [...tasks.map(x => ({ ...x, stage: stageOf(x.label) })), ...agents]
  const live = all.filter(x => !x.doneAt)
  // the ticket last named, unless nothing here belongs to it while running work or a watched PR
  // belongs to another: a ticket with work under way beats an empty one
  const named = await read($, ticket)
  const active = live.find(x => x.ticket)?.ticket ?? [...watched].reverse().find(p => p.ticket && p.state !== 'MERGED' && p.state !== 'CLOSED')?.ticket
  const idle = named && !all.some(x => x.ticket === named) && !watched.some(p => p.ticket === named)
  // with nothing running either, the ticket most recently worked on, a just-merged one included
  const lastWorked = [...watched].reverse().find(p => p.ticket)?.ticket ?? [...all].reverse().find(x => x.ticket)?.ticket
  // a ticket whose PR is finished and under which nothing runs gives way to running work elsewhere
  const done = named && !live.some(x => x.ticket === named) && watched.some(p => p.ticket === named && (p.state === 'MERGED' || p.state === 'CLOSED'))
  const cur = (idle && (active || lastWorked)) || (done && active) || named || active || ''
  const recent = tasks.filter(x => x.doneAt).slice(-2)

  // the view: one row per step of the current ticket, CI and merge from its PR
  const mine = all.filter(x => x.ticket === cur)
  const pr = [...watched].reverse().find(p => p.ticket === cur) ?? (cur ? undefined : watched[watched.length - 1])
  const repo = pr?.repo ?? sessionRepo
  // remaining time: what this kind of step took before, less what it has run; unknown until learned
  // a running step with no history can't count down: the estimate then starts when it ends
  let left = 0
  let unknown = 0
  let blocker = ''
  // the blocker ran past what its step usually takes (it has history, just not enough)
  let isOverdue = false
  const steps: Step[] = []
  const seen = STAGES.map(stage => [...mine].reverse().find(x => x.stage === stage))
  // a step before one already under way was done where this pane could not see it
  const furthest = Math.max(-1, ...seen.map((x, i) => (x ? i : -1)), pr ? STAGES.length : -1)
  for (const [i, stage] of STAGES.entries()) {
    const last = seen[i]
    const mark: Mark = !last ? (i < furthest ? 'skip' : 'none')
      : !last.doneAt ? 'run' : last.status && last.status !== 'completed' ? 'fail' : 'done'
    const typical = median(await stagePast($, sessionRepo, stage))
    const ran = last && !last.doneAt && last.startedAt ? t - last.startedAt : 0
    const name = s[stage as 'write' | 'review' | 'verify']
    const over = mark === 'run' && typical > 0 && ran > typical
    if (mark === 'run' || (mark === 'none' && cur)) {
      if (typical && !over) left += Math.max(mark === 'run' ? 60000 : 0, typical - ran)
      else if (mark === 'run') {
        if (!blocker) isOverdue = over
        blocker ||= name
      } else unknown++
    }
    const parts = [last && !last.doneAt && last.startedAt ? ago(ran) : '', mark === 'run' && typical ? (over ? s.usually(mins(typical)) : s.left(mins(Math.max(60000, typical - ran)))) : '']
    steps.push({ name, mark, note: parts.filter(Boolean).join(' · ') })
  }
  let eta = 0
  let ci: Step = { name: 'CI', mark: 'none', note: '', isCi: true }
  let bar = ''
  if (pr) {
    const pend = pr.checks.filter(c => c.state === 'pending')
    const fail = pr.checks.filter(c => c.state === 'fail')
    const pass = pr.checks.filter(c => c.state === 'pass')
    for (const c of pend) {
      const prior = await past($, ciKey(repo, c.name))
      if (prior.length && c.startedAt) eta = Math.max(eta, median(prior) - (t - c.startedAt))
    }
    // a run that has only queued its quick checks so far still takes as long as a whole run
    const whole = median(await past($, ciKey(repo, 'total')))
    const runStart = Math.min(...pend.map(c => c.startedAt ?? t))
    if (pend.length && whole) eta = Math.max(eta, whole - (t - runStart), 60000)
    const n = pr.checks.length
    if (n) bar = '▰'.repeat(Math.round((pass.length / n) * 6)) + '▱'.repeat(6 - Math.round((pass.length / n) * 6))
    ci = fail.length ? { name: 'CI', mark: 'fail', note: s.failed(fail.length), isCi: true }
      : pend.length ? { name: 'CI', mark: 'run', note: `${pass.length}/${n}${eta > 0 ? ` · ${s.left(mins(eta))}` : ''}`, isCi: true }
      : n ? { name: 'CI', mark: 'done', note: s.allGreen, isCi: true } : { name: 'CI', mark: 'none', note: s.loading, isCi: true }
  }
  const ciTypical = median(await past($, ciKey(repo, 'total')))
  if (ci.mark === 'run') eta > 0 ? (left += eta) : (blocker ||= 'CI')
  else if (ci.mark === 'none' && cur) ciTypical ? (left += ciTypical) : unknown++
  // red while work still runs: another run is coming (a gate before the full run, a fix being pushed)
  else if (ci.mark === 'fail' && live.length) ciTypical ? (left += ciTypical) : unknown++
  const finished = pr?.state === 'MERGED'
  // a ticket with no work and no PR in this session has not started: no time to give
  if (cur && !all.some(x => x.ticket === cur) && !pr && !blocker) left = unknown = 0
  const ticking = ci.mark === 'run' || steps.some(x => x.mark === 'run')
  const etaLine = finished ? s.done
    : left === 0 && unknown === 0 && !blocker ? ''
    : left === 0 ? s.learning
    : (blocker ? (isOverdue ? s.slow(blocker, mins(left)) : s.after(blocker, mins(left)))
      // nothing under way: the time is real, but the clock has not started
      : !ticking ? s.pending(mins(left))
      : s.eta(mins(left))) + (unknown ? s.noHistory(unknown) : '')
  const merged: Step = { name: s.merge, mark: finished ? 'done' : 'none', note: pr ? `PR #${pr.number}` : '' }
  const failNames = pr ? pr.checks.filter(c => c.state === 'fail').map(c => c.name).slice(0, 2) : []
  const rows = [...steps, ci, merged]

  const busy = live.length > 0 || who === 'working'
  const yourTurn = who === 'asking' ? s.askPending
    : waiting ? waiting
    : who === 'idle' && !busy ? s.idleWaiting : ''

  motion = !still && (busy || ci.mark === 'run')
  return { s, t, tasks, live, recent, cur, pr, steps, ci, rows, bar, etaLine, left, blocker, finished, failNames, busy, yourTurn, frame_, still }
}

// The band above the prompt: the ticket, the step under way, the time left, and whether it is your turn.
export function barOf(v: Awaited<ReturnType<typeof viewOf>>) {
  const running = v.steps.find(x => x.mark === 'run') ?? (v.ci.mark === 'run' ? v.ci : undefined)
  const ticking = v.ci.mark === 'run' || v.steps.some(x => x.mark === 'run')
  const time = v.finished ? v.s.done
    : v.left <= 0 ? ''
    : v.blocker ? '≥ ' + v.s.short(mins(v.left))
    : !ticking ? v.s.shortPending(mins(v.left))
    : v.s.short(mins(v.left))
  return { running, time, isEmpty: !v.cur && !running && !v.yourTurn }
}

export type BarMode = 'always' | 'auto' | 'off'
export const barModeOf = (v: unknown): BarMode => (v === 'auto' || v === 'off' ? v : 'always')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'progress',
      description: 'Open the progress pane · still / move · bar always|auto|off · lang en|zh-Hant|zh-Hans|ja|auto',
    })
    if ((await $.store.get('still')) === true) await update($, quiet, () => true)
    const picked = normalizeLang(await $.store.get('lang'))
    if (picked) await update($, langPick, () => picked)
    const fromSettings = normalizeLang(await $.settings.read({ key: 'language' }).catch(() => undefined))
    const fromEnv = normalizeLang(await $.env.get('LANG'))
    if (fromSettings ?? fromEnv) await update($, langAuto, () => (fromSettings ?? fromEnv)!)
    // a language setting outranks $LANG; the person's own writing (prompt.submit) outranks $LANG too
    if (fromSettings) await $.store.set('langFromSettings', true)
    else {
      await $.store.delete('langFromSettings')
      // a resumed or reloaded conversation already says which language the person writes in
      // the language most of the last ten user rows are in: a relayed notice now and then does not tip it
      const history = ((await $.session.messages().catch(() => [])) as any[])
        .filter(m => m.role === 'user' && typeof m.text === 'string' && !/^\s*[<\/[]/.test(m.text))
        .map(m => detectLang(m.text))
        .filter((l): l is Lang => Boolean(l))
        .slice(-10)
      await update($, said, () => history)
      const l = mostOf(history)
      if (l) await update($, langAuto, () => l)
    }

    void $.ui.open({ id: PANE, title: STRINGS[await langNow($)].title })
    $.clock.after(5000, async () => {
      const cwd = await $.session.cwd()
      const repo = await repoOf($, cwd)
      if (repo) {
        await update($, repoNow, () => repo)
        await seedCi($, cwd, repo)
      }
    })
    $.clock.every(60000, async () => {
      const at = await $.clock.now()
      await update($, now, () => at)
      await poll($)
    })
    // 1.2.x pinned a line under the prompt; the band above it replaces that line
    $.ui.status(undefined)
    const savedBar = await $.store.get('bar')
    if (savedBar !== undefined) await update($, barMode, () => barModeOf(savedBar))
    $.clock.every(250, async () => {
      if (motion) await update($, frame, f => (f + 1) % 1600)
    })
    return next(e)
  })

  on('command.run', { command: 'progress' }, async ($, e) => {
    const [word = '', arg = ''] = e.args.trim().split(/\s+/)
    const pick = word.toLowerCase()
    let text: string | undefined
    if (pick === 'bar') {
      const mode = arg.toLowerCase()
      if (mode === 'always' || mode === 'auto' || mode === 'off') {
        await $.store.set('bar', mode)
        await update($, barMode, () => mode)
      }
      const l = await langNow($)
      text = mode === 'always' || mode === 'auto' || mode === 'off' ? STRINGS[l].barSet[mode] : STRINGS[l].barUnknown
    }
    if (pick === 'lang' || pick === 'language') {
      if (arg.toLowerCase() === 'auto') {
        await update($, langPick, () => '')
        await $.store.delete('lang')
        text = STRINGS[await langNow($)].langSet(`auto (${langName(await langNow($))})`)
      } else {
        const l = normalizeLang(arg)
        if (l) {
          await update($, langPick, () => l)
          await $.store.set('lang', l)
          text = STRINGS[l].langSet(langName(l))
        } else text = STRINGS[await langNow($)].langUnknown
      }
    }
    const still = ['still', 'off', 'static'].includes(pick) ? true : ['move', 'on', 'animate'].includes(pick) ? false : undefined
    if (still !== undefined) {
      await update($, quiet, () => still)
      await $.store.set('still', still)
    }
    const s = STRINGS[await langNow($)]
    await $.ui.open({ id: PANE, title: s.title })
    return { text: text ?? (still === undefined ? s.opened : still ? s.motionOff : s.motionOn) }
  })

  on('prompt.submit', async ($, e, next) => {
    if (isPerson(e)) {
      await update($, ask, () => '')
      // the person's own words say which language they read, unless Claude Code's setting already does
      const l = e.command ? undefined : detectLang(e.text)
      if (l && !(await $.store.get('langFromSettings'))) {
        const recent = await update($, said, list => [...list, l].slice(-10))
        const most = mostOf(recent)
        if (most) await update($, langAuto, () => most)
      }
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) await update($, turn, () => 'working')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      await update($, turn, () => 'idle')
      // a reply with no decision keeps the one still unanswered; only the person's reply clears it
      const waiting = askOf(e.answer)
      if (waiting) await update($, ask, () => waiting)
    }
    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await update($, turn, () => 'asking')
    const ran = await next(e)
    await update($, turn, () => 'working')
    return ran
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const ran = await next(e)
    const id = (ran as any).result?.agentId
    if (id) {
      const t = ticketOfName(e.description)
      if (t) await update($, ticket, () => t)
      const task: BgTask = { id, label: e.description, kind: 'agent', stage: stageOf(e.description), ticket: t ?? ((await read($, ticket)) || undefined), startedAt: await $.clock.now() }
      // a foreground agent has already finished by the time next resolves
      if ((ran as any).result?.content) task.doneAt = task.startedAt
      await update($, bg, all => [...all, task].slice(-10))
    }
    return ran
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const cmd = e.command
    const cd = cmd.match(CD)
    const cwd = (cd && (cd[2] ?? cd[3] ?? cd[4])) || (await $.session.cwd())

    let t = ticketOfCommand(cmd)
    const dir = ticketDirOf(cmd)
    if (t && dir && ticketOfRef(dir) === t && !(await isTicketTree($, dir, t))) t = undefined
    if (t) await update($, ticket, () => t)

    const ref = cmd.match(PR_REF)
    if (ref) await watchPr($, Number(ref[1] ?? ref[2]), cmd.match(REPO_FLAG)?.[1], cwd, false)
    const out = String((ran as any).result?.stdout ?? '')
    const url = /\bgh\s+pr\s+create\b|\bgit\s+push\b|\bship\b/.test(cmd) ? out.match(PR_URL) : null
    if (url) await watchPr($, Number(url[2]), url[1], cwd, true)

    const id = (ran as any).result?.backgroundTaskId
    if (id) {
      const label = e.description ?? labelOf(cmd)
      const task: BgTask = { id, label, kind: 'bash', stage: stageOf(e.description ?? cmd), ticket: t ?? ((await read($, ticket)) || undefined), startedAt: await $.clock.now() }
      await update($, bg, all => [...all, task].slice(-10))
    }
    return ran
  })

  on('session.append', async ($, e, next) => {
    if ((e.origin as any)?.kind === 'task-notification') {
      const text = JSON.stringify(e.message.content)
      const id = text.match(/<task-id>([^<]+)<\/task-id>/)?.[1]
      const status = text.match(/<status>([^<]+)<\/status>/)?.[1]
      if (id) await finish($, id, status)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const mode = await read($, barMode)
    if (e.props.hasSurvey || mode === 'off') return next(e)
    if (mode === 'auto') {
      const panes = (await $.ui.panes().catch(() => [])) as any[]
      if (panes.some(p => p.id === PANE && p.isPlaced && p.isShown)) return next(e)
    }
    const v = await viewOf($)
    const { running, time, isEmpty } = barOf(v)
    if (isEmpty) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const glyph = v.still ? '✻' : SPIN[v.frame_ % SPIN.length]!
    const shimmer = v.still || !v.bar.includes('▱') ? v.bar : v.bar.replace('▱', v.frame_ % 2 ? '▰' : '▱')
    return (
      <Box flexDirection="row" gap={2}>
        {v.cur ? <Text bold>{v.cur}</Text> : ''}
        {running ? <Text><Text color="claude">{glyph}</Text> {running.name}{running.isCi && v.bar ? <Text color="claude"> {shimmer}</Text> : ''}</Text> : ''}
        {time ? <Text color={v.finished ? 'success' : 'claude'}>{time}</Text> : ''}
        {v.yourTurn ? <Text bold color="warning">{v.s.yourTurn}</Text> : ''}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { s, t, live, recent, cur, pr, steps, ci, rows, bar, etaLine, finished, failNames, busy, yourTurn, frame_, still } = await viewOf($)
    const width = Math.max(24, (e.props as any).bodyColumns ?? 40)
    const ago = (ms: number, from = 1) => (!from ? '' : ms < 60000 ? s.justStarted : s.minutes(Math.round(ms / 60000)))
    const spin = SPIN[frame_ % SPIN.length]!
    const GLYPH: Record<Mark, string> = { done: '✓', run: still ? '✻' : spin, fail: '✕', none: '○', skip: '–' }
    const COLOR: Record<Mark, string | undefined> = { done: 'success', run: 'claude', fail: 'error', none: undefined, skip: undefined }
    const title = cur || s.ticket
    const fit = (x: string, n: number) => (x.length > n ? x.slice(0, n - 1) + '…' : x)
    // the CI bar's next cell pulses while checks run
    const shimmer = still || !bar.includes('▱') ? bar : bar.replace('▱', frame_ % 2 ? '▰' : '▱')

    // a red check is an alarm only when nobody is at work on it: while work runs it stays on its row
    const mood: Mood = (ci.mark === 'fail' || steps.some(x => x.mark === 'fail')) && !busy ? 'fail'
      : finished ? 'done' : yourTurn ? 'ask' : busy ? 'work' : 'idle'
    const spark = sparkFor(mood, still ? 4 : frame_)
    const SPARK_COLOR: Record<Mood, string | undefined> = { work: 'claude', ask: 'warning', idle: undefined, fail: 'error', done: 'success' }

    const stepRow = (x: Step) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Text>
          <Text color={COLOR[x.mark]} dimColor={x.mark === 'none' || x.mark === 'skip'}>{GLYPH[x.mark]} </Text>
          <Text dimColor={x.mark === 'none' || x.mark === 'skip'} bold={x.mark === 'run'}>{x.name}</Text>
          {x.isCi && bar && x.mark === 'run' ? <Text color="claude"> {shimmer}</Text> : ''}
        </Text>
        <Text dimColor>{x.note}</Text>
      </Box>
    )
    const taskRow = (x: BgTask) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Text><Text color="claude">{still ? '✻' : spin} </Text>{fit(x.label, width - 12)}</Text>
        <Text dimColor>{ago(t - x.startedAt, x.startedAt)}</Text>
      </Box>
    )
    const doneRow = (x: BgTask) => {
      const bad = x.status && x.status !== 'completed'
      return <Text dimColor><Text color={bad ? 'error' : 'success'}>{bad ? '✕' : '✓'}</Text> {fit(x.label, width - 6)}</Text>
    }

    // seated above the prompt (no room to dock): two or three plain lines instead of three cards
    if ((e.props as any).placement === 'inline') {
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={2}>
            <Text bold>{title}</Text>
            {cur || pr
              ? <Text>{rows.map((x, i) => <Text><Text color={COLOR[x.mark]} dimColor={x.mark === 'none' || x.mark === 'skip'}>{GLYPH[x.mark]} </Text><Text dimColor={x.mark === 'none' || x.mark === 'skip'} bold={x.mark === 'run'}>{x.name}</Text>{i < rows.length - 1 ? <Text dimColor> · </Text> : ''}</Text>)}</Text>
              : <Text dimColor>{s.noTicket}</Text>}
          </Box>
          {(etaLine || live.length > 0) && (
            <Box flexDirection="row" gap={2}>
              {etaLine ? <Text color={finished ? 'success' : 'claude'}>{etaLine}</Text> : ''}
              {live.length ? <Text dimColor>{s.background} · {s.running(live.length)}</Text> : ''}
            </Box>
          )}
          {yourTurn ? <Text><Text bold color="warning">{s.yourTurn}</Text>  {fit(yourTurn, width - s.yourTurn.length - 4)}</Text> : ''}
        </Box>
      )
    }

    // each section a quiet rounded card; only the waiting card and the spark take color
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column" borderStyle="round" borderColor="gray" borderDimColor paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="column">
              <Text bold>{title}</Text>
              <Text dimColor>{pr?.title ? fit(pr.title, width - 16) : ''}</Text>
              <Text color={SPARK_COLOR[mood]} dimColor={mood === 'idle'}>{s.mood[mood]}</Text>
            </Box>
            <Box flexDirection="column">
              {spark.map(line => <Text color={SPARK_COLOR[mood]} dimColor={mood === 'idle'}>{line}</Text>)}
            </Box>
          </Box>
          <Text> </Text>
          {cur || pr ? rows.map(stepRow) : <Text dimColor>{s.noTicket}</Text>}
          {failNames.length > 0 && <Text color="error">  {failNames.join(s.sep)}</Text>}
          {etaLine && <Text color={finished ? 'success' : 'claude'}>{etaLine}</Text>}
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="gray" borderDimColor paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>{s.background}</Text>
            <Text dimColor>{live.length ? s.running(live.length) : ''}</Text>
          </Box>
          {live.length === 0 && recent.length === 0 && <Text dimColor>{s.none}</Text>}
          {live.map(taskRow)}
          {recent.map(doneRow)}
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor={yourTurn ? 'warning' : 'gray'} borderDimColor={!yourTurn} paddingX={1}>
          <Text bold color={yourTurn ? 'warning' : undefined}>{yourTurn ? s.yourTurn : s.yourTurnNone}</Text>
          {yourTurn ? <Text>{yourTurn}</Text> : <Text dimColor>{busy ? s.stillWorking : ''}</Text>}
        </Box>
      </Box>
    )
  })
}
