import { expect, mock, test } from 'claude-code/testing'

import { SAMPLE_ROLLUP } from './ci-fixture'
import { askOf, detectLang, normalizeLang, STRINGS } from './i18n'
import { checksOf, ciTotal, isPerson, labelOf, latestRuns, mostOf, sparkFor, stageOf, ticketOfCommand, ticketOfName } from './register'

const PANE = {
  plugin: 'brainless-claude-progress', component: 'Pane', requestId: 'progress',
  props: { title: 'Progress', isFocused: false, bodyColumns: 44, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

// the engine beneath the mod, as each test needs it
function engine(on: any, opts: { prUrl?: string; status?: (string | undefined)[]; panes?: () => unknown[]; history?: string[]; agents?: unknown[]; store?: Record<string, unknown>; LANG?: string; language?: string; gh?: (argv: string[]) => string } = {}) {
  mock.store(on, opts.store ?? {})
  mock.env(on, { LANG: opts.LANG ?? 'en_US.UTF-8' })
  // a real moment, just after the sample CI runs began: the pane reads 0 as "started before we watched"
  const clock = mock.clock(on, { now: Date.parse('2025-01-06T09:12:00Z') })
  on('settings.read', () => ({ value: opts.language ? { language: opts.language } : {} }))
  on('command.register', () => ({ value: { command: 'progress' } }))
  on('command.run', (_: any, e: any) => ({ text: e.args }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/' }))
  on('ui.panes', () => ({ value: opts.panes?.() ?? [] }))
  on('ui.status', (_: any, e: any) => { opts.status?.push(e.text); return { value: undefined } })
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>ENGINE BAND</Text> })
  on('session.messages', () => ({ value: (opts.history ?? []).map(text => ({ role: 'user', text, toolUses: [] })) }))
  on('agent.list', () => ({ value: opts.agents ?? [] }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('process.run', (_: any, e: any) => {
    // git: any folder is its own work tree except a scratch one (named "...-shots")
    if (e.argv[0] === 'git' && e.argv.includes('rev-parse')) {
      const dir = String(e.argv[2])
      return { value: { exitCode: /shots/.test(dir) ? 128 : 0, stdout: /shots/.test(dir) ? '' : dir.replace(/\/src$/, '') + '\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: opts.gh ? 0 : 1, stdout: opts.gh?.(e.argv) ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', (_: any, e: any) =>
    e.tool === 'Agent'
      ? { result: { status: 'async_launched', agentId: 'a1' } }
      : { result: { stdout: /gh pr create/.test(e.command ?? '') ? opts.prUrl ?? '' : '', stderr: '', interrupted: false, backgroundTaskId: e.run_in_background ? 'b1' : undefined } })
  return clock
}
const start = ($: any) => $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
const reply = (answer: string) => ({ answer, durationMs: 1, isAborted: false, turnId: answer.slice(0, 20), reason: 'end_turn' }) as any
const verify = ($: any, name = 'Device verify #128') =>
  $.tool.call({ tool: 'Agent', description: name, prompt: 'go', run_in_background: true })
// the band above the prompt, as one line of its texts in order (the engine's own when the mod leaves it)
async function band($: any) {
  const ui = await $.ui.mount({
    plugin: 'brainless-claude-progress', component: 'AbovePrompt', surface: 'terminal',
    props: { hasSurvey: false, isWorking: true, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
  })
  const parts: string[] = []
  for (const re of [/^ENGINE BAND$/, /^#\d+$/, /^[·✢✳✶✻✽] /, /分|min|Done|完成/, /^(輪到你|Your turn)$/]) {
    const t = (await ui.find({ type: 'Text', text: re }))?.text
    if (t) parts.push(t)
  }
  await ui.unmount()
  return parts.join(' | ')
}

async function view($: any, surface: 'terminal' | 'desktop' = 'terminal') {
  const ui = await $.ui.mount({ ...PANE, surface })
  return {
    text: async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text,
    close: () => ui.unmount(),
  }
}

// ── reading replies ──────────────────────────────────────────────

test('a decision heading is found in every language and markdown dress', async () => {
  expect(askOf('**要你決定：** 兩個取捨可以接受嗎？我推薦先接受。\n\n**未執行：**\n- x')).toBe('兩個取捨可以接受嗎？我推薦先接受。')
  expect(askOf('## Decision needed\n- Ship on Friday or Monday?\n- Keep the old flag?\n\nNext steps: ...')).toBe('Ship on Friday or Monday? / Keep the old flag?')
  expect(askOf('要你决定：用 A 还是 B？')).toBe('用 A 还是 B？')
  expect(askOf('ご判断ください：今日マージしますか？')).toBe('今日マージしますか？')
  expect(askOf('請你親眼看：打開設定頁看深色模式。')).toBe('打開設定頁看深色模式。')
})

test('a decision outranks a request to go and look, even when the look comes first', async () => {
  const reply = `**請你親眼看：** 截圖在 shots/ 資料夾。

**要你決定：**
- 英文版返回鍵仍顯示 Back。選 A 或 B？
- 淺色模式頂端看不到時間。另開小票嗎？

**未執行：**
- 真機沒有驗。`
  expect(askOf(reply)).toBe('英文版返回鍵仍顯示 Back。選 A 或 B？ / 淺色模式頂端看不到時間。另開小票嗎？')
  expect(askOf('Please check: the screenshot in shots/.')).toBe('the screenshot in shots/.')
})

test('with no heading, a reply that ends on a question is waiting; one that does not is not', async () => {
  expect(askOf('I fixed the parser and the tests pass.\n\nShould I also update the README?')).toBe('Should I also update the README?')
  expect(askOf('改好了。要我順便推上去嗎？')).toBe('要我順便推上去嗎？')
  expect(askOf('Done. All 12 tests pass.')).toBe('')
  // a question inside code or followed by a sources list is not the reply's last word
  expect(askOf('Done.\n\n```\nwhat?\n```')).toBe('')
  expect(askOf('Want me to push it?\n\nSources:\n- https://x.dev')).toBe('Want me to push it?')
})

test('the person’s language is read from what they write', async () => {
  expect(detectLang('幫我看一下這個問題')).toBe('zh-Hant')
  expect(detectLang('帮我看一下这个问题')).toBe('zh-Hans')
  expect(detectLang('この問題を見てください')).toBe('ja')
  expect(detectLang('please look at this failing test')).toBe('en')
  expect(detectLang('1')).toBeUndefined()
  expect(detectLang('ok')).toBeUndefined()
  // a pasted path or code does not make an English reader out of a Chinese one
  expect(detectLang('改這個 `src/components/SettingsView.tsx` 的排版')).toBe('zh-Hant')
  expect(normalizeLang('zh_TW.UTF-8')).toBe('zh-Hant')
  expect(normalizeLang('zh-CN')).toBe('zh-Hans')
  expect(normalizeLang('Japanese')).toBe('ja')
  expect(normalizeLang('en_US.UTF-8')).toBe('en')
  expect(normalizeLang('fr_FR')).toBeUndefined()
})

test('every language has every string', async () => {
  const keys = Object.keys(STRINGS.en).sort()
  for (const l of ['zh-Hant', 'zh-Hans', 'ja'] as const) expect([l, Object.keys(STRINGS[l]).sort()]).toEqual([l, keys])
})

// ── recognising the ticket and the step ─────────────────────────

test('a ticket comes from where the work says it is, not from any number in a command', async () => {
  expect(ticketOfName('Device verify #128')).toBe('#128')
  expect(ticketOfName('Review PROJ-42 login fix')).toBe('PROJ-42')
  expect(ticketOfName('Check UTF-8 handling')).toBeUndefined()
  expect(ticketOfName('Hash with SHA-256')).toBeUndefined()

  expect(ticketOfCommand('cd /home/me/src/app/128-small-fixes && npm test')).toBe('#128')
  expect(ticketOfCommand('cd "/repo/worktrees/PROJ-42-login" && git status')).toBe('PROJ-42')
  expect(ticketOfCommand('git checkout -b claude/731-dark-mode')).toBe('#731')
  expect(ticketOfCommand('git push -u origin feature/PROJ-9-search')).toBe('PROJ-9')
  expect(ticketOfCommand('git worktree add /tmp/wt/88-fix -b me/88-fix origin/main')).toBe('#88')
  expect(ticketOfCommand('gh issue develop 412 --checkout')).toBe('#412')
  // noting something on another ticket does not move the work there
  for (const verb of ['view', 'comment', 'edit', 'close'])
    expect([verb, ticketOfCommand(`cat > note.md <<'EOF'\nfollow-up\nEOF\ngh issue ${verb} 130 --body-file note.md`)]).toEqual([verb, undefined])
  // the session that wrote a test file mentioning "#128" is not working on #128
  expect(ticketOfCommand("cat > test.ts <<'EOF'\nverify('Device verify #128', '/w/128-x')\nEOF")).toBeUndefined()
  expect(ticketOfCommand('grep -n "#128" notes.md')).toBeUndefined()
})

test('steps are told apart in four languages', async () => {
  expect(['Review PR 12', '審查程式', '审查代码', 'コードレビュー'].map(stageOf)).toEqual(['review', 'review', 'review', 'review'])
  expect(['Device verify #1', 'Run e2e tests', '上機驗證', '验证修复', '動作検証'].map(stageOf)).toEqual(['verify', 'verify', 'verify', 'verify', 'verify'])
  expect(['Implement search', 'Fix the crash', '寫程式', '实现搜索', '実装する'].map(stageOf)).toEqual(['write', 'write', 'write', 'write', 'write'])
  expect(['Run full local CI and typecheck', 'npm run lint', 'tsc --noEmit'].map(stageOf)).toEqual(['verify', 'verify', 'verify'])
  expect(stageOf('Explore the codebase')).toBe('other')
  // waiting on a step is not doing it
  expect(['Wait for the CI gate and the review', 'Wait for preflight then run ship', '等 CI 跑完', '等待审查结果', 'CI の完了を待つ'.replace(/^/, '待機: ')].map(stageOf)).toEqual(['other', 'other', 'other', 'other', 'other'])
})

// ── CI ───────────────────────────────────────────────────────────

test('CI time counts only the newest run of each check, not the red preflight before it', async () => {
  const runs = latestRuns(SAMPLE_ROLLUP)
  expect(runs.length).toBe(6)
  expect(runs.find(c => c.name === 'test')?.conclusion).toBe('SUCCESS')
  expect(Math.round(ciTotal(SAMPLE_ROLLUP) / 6000) / 10).toBe(16.8)
})

test('each repository keeps its own CI history, read from its merged PRs', async ($, on) => {
  const clock = engine(on, {
    gh: argv => argv.includes('nameWithOwner') ? 'me/app\n'
      : argv.includes('list') ? JSON.stringify([{ statusCheckRollup: SAMPLE_ROLLUP }])
      : argv.includes('view') ? JSON.stringify({ title: 'Site fix', state: 'OPEN', url: 'https://github.com/other/site/pull/5', headRefName: 'me/128-site', statusCheckRollup: [] }) : '{}',
    store: { 'dur:ci:other/site:total': [2 * 60000], 'seeded:other/site': true },
  })
  await start($)
  await verify($)
  let v = await view($)
  expect(await v.text(/^Done in:/)).toBe('Done in: still learning, needs a few finished runs')
  await v.close()

  await clock.advance(6000)
  v = await view($)
  // me/app's 17 minutes, not other/site's 2
  expect(await v.text(/^(Done|At least)/)).toBe('At least ~17 min more (no history yet for Verify)')
  await v.close()

  // a PR in the other repository is estimated from that repository's own history
  await $.tool.call({ tool: 'Bash', command: 'gh pr view 5 -R other/site --json state' })
  await clock.advance(60000)
  v = await view($)
  expect(await v.text(/^(Done|At least)/)).toBe('At least ~2 min more (no history yet for Verify)')
  await v.close()
})

// ── the pane ─────────────────────────────────────────────────────

test('the ticket, a learned estimate, a task and a waiting decision, drawn on two surfaces', async ($, on) => {
  engine(on, { store: { 'dur:stage:verify': [10 * 60000] } })
  await start($)
  await verify($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-x && codex exec review', description: 'Codex review', run_in_background: true })
  await $.turn.complete(reply('Done.\n\n**Decision needed:** Accept the two trade-offs?'))
  for (const surface of ['terminal', 'desktop'] as const) {
    const v = await view($, surface)
    expect(await v.text(/^#128$/)).toBe('#128')
    expect(await v.text(/~10 min left/)).toContain('just started')
    // review runs with no history, so the count starts when it ends; write, unseen before it, is not waited for
    expect(await v.text(/^(Done|At least)/)).toBe('At least ~10 min more (no history yet for Review) (1 step without history yet)')
    expect(await v.text(/Write/)).toBe('– Write')
    expect(await v.text(/Device verify/)).toContain('Device verify #128')
    expect(await v.text(/trade-offs/)).toBe('Accept the two trade-offs?')
    expect(await v.text(/^your turn$/)).toBe('your turn')
    await v.close()
  }
})

test('the language follows Claude Code’s setting, else the person’s writing, else $LANG, else /progress lang', async ($, on) => {
  engine(on, { LANG: 'en_US.UTF-8' })
  await start($)
  let v = await view($)
  expect(await v.text(/^Background$/)).toBe('Background')
  await v.close()

  await $.prompt.submit({ text: '幫我看一下這個畫面', origin: { kind: 'composer' } } as any)
  v = await view($)
  expect(await v.text(/^背景工作$/)).toBe('背景工作')
  await v.close()

  await $.command.run({ command: 'progress', args: 'lang ja' } as any)
  await $.prompt.submit({ text: 'please check again', origin: { kind: 'composer' } } as any)
  v = await view($)
  // a choice the person made outranks what they happen to type next
  expect(await v.text(/^バックグラウンド$/)).toBe('バックグラウンド')
  await v.close()

  await $.command.run({ command: 'progress', args: 'lang auto' } as any)
  v = await view($)
  expect(await v.text(/^Background$/)).toBe('Background')
  await v.close()
})

test('a reloaded conversation starts in the language the person has been writing in', async ($, on) => {
  engine(on, { LANG: 'en_US.UTF-8', history: ['幫我看一下這個畫面', '<task-notification>done</task-notification>', '/progress'] })
  await start($)
  const v = await view($)
  expect(await v.text(/^背景工作$/)).toBe('背景工作')
  await v.close()
})

test('a running agent named for a ticket makes it the current ticket when nothing else says so', async ($, on) => {
  engine(on, { agents: [{ id: 'old', description: 'Device verify #128', type: 'general-purpose', status: 'running' }] })
  await start($)
  const v = await view($)
  expect(await v.text(/^#128$/)).toBe('#128')
  expect(await v.text(/Verify/)).toMatch(/^[·✢✳✶✻✽] Verify$/)
  await v.close()
})

test('a notification is not the person: it neither changes the language nor clears a waiting decision', async ($, on) => {
  engine(on, { history: ['幫我看一下這個畫面', '可以', '改好了嗎？', 'Another Claude session sent a message: the build finished on main'] })
  await start($)
  await $.turn.complete(reply('要你決定：今天合併嗎？'))
  await $.prompt.submit({ text: '<task-notification>Background command "Device verify" completed (exit code 0)</task-notification>', origin: { kind: 'task-notification' } } as any)
  await $.prompt.submit({ text: 'Another Claude session sent a message: review passed with no findings', origin: { kind: 'peer-send-message' } } as any)
  let v = await view($)
  expect(await v.text(/^背景工作$/)).toBe('背景工作')
  expect(await v.text(/今天合併/)).toBe('今天合併嗎？')
  await v.close()
  // the person's own words through Remote Control do count (enough of them move the language)
  for (const text of ['ok go ahead and merge it today please', 'and then open the next ticket', 'also delete the old folder', 'thanks, carry on with the plan'])
    await $.prompt.submit({ text, origin: { kind: 'bridge' } } as any)
  v = await view($)
  expect(await v.text(/^Background$/)).toBe('Background')
  expect(await v.text(/今天合併/)).toBeFalsy()
  await v.close()
})

test('the person is anyone typing, whatever this build calls it; notices, peers and triggers are not', async () => {
  for (const kind of ['composer', 'human', 'bridge', 'something-new'])
    expect([kind, isPerson({ text: 'x', origin: { kind } })]).toEqual([kind, true])
  for (const kind of ['task-notification', 'peer-send-message', 'scheduled-trigger', 'auto-continuation', 'coordinator'])
    expect([kind, isPerson({ text: 'x', origin: { kind } })]).toEqual([kind, false])
  expect(isPerson({ text: 'x', isMeta: true, origin: { kind: 'human' } })).toBe(false)
  expect(isPerson({ text: '/progress', command: { name: 'progress', args: '' }, origin: { kind: 'human' } })).toBe(false)
})

test('an answer typed as "human" clears the waiting decision (seen in use)', async ($, on) => {
  engine(on)
  await start($)
  await $.turn.complete(reply('要你決定：今天合併嗎？'))
  await $.prompt.submit({ text: '1', origin: { kind: 'human' } } as any)
  const v = await view($)
  expect(await v.text(/今天合併/)).toBeFalsy()
  await v.close()
})

test('the starting language is the one most recent messages are in, ties to the latest', async () => {
  expect(mostOf(['zh-Hant', 'zh-Hant', 'en'])).toBe('zh-Hant')
  expect(mostOf(['en', 'zh-Hant'])).toBe('zh-Hant')
  expect(mostOf([])).toBeUndefined()
})

test('one short line in another language does not flip the pane ("progress bar off" in a Chinese conversation)', async ($, on) => {
  engine(on, { history: ['幫我看一下這個畫面', '可以，照你建議', '現在進度？'] })
  await start($)
  await $.prompt.submit({ text: 'progress bar off', origin: { kind: 'human' } } as any)
  let v = await view($)
  expect(await v.text(/^背景工作$/)).toBe('背景工作')
  await v.close()
  // a person who keeps writing in English does move it
  for (const text of ['please check the build again', 'ok now open the PR', 'what is left to do here'])
    await $.prompt.submit({ text, origin: { kind: 'human' } } as any)
  v = await view($)
  expect(await v.text(/^Background$/)).toBe('Background')
  await v.close()
})

test('Claude Code’s language setting outranks what the person types', async ($, on) => {
  engine(on, { language: 'Simplified Chinese' })
  await start($)
  await $.prompt.submit({ text: 'please look at the failing build', origin: { kind: 'composer' } } as any)
  const v = await view($)
  expect(await v.text(/^后台任务$/)).toBe('后台任务')
  await v.close()
})

test('an agent only the engine knows still counts as running', async ($, on) => {
  engine(on, { agents: [{ id: 'old', description: 'Device verify #128', type: 'general-purpose', status: 'running' }] })
  await start($)
  await $.turn.complete(reply('The review is back.'))
  const v = await view($)
  expect(await v.text(/Device verify/)).toBeTruthy()
  expect(await v.text(/^Your turn/)).toBe('Your turn: nothing')
  await v.close()
})

test('an unanswered decision survives a later reply without one, and clears when the person answers', async ($, on) => {
  engine(on)
  await start($)
  await $.turn.complete(reply('Decision needed: merge today?'))
  await $.turn.complete(reply('The review is back.'))
  let v = await view($)
  expect(await v.text(/merge today/)).toBe('merge today?')
  await v.close()
  await $.prompt.submit({ text: 'yes merge it', origin: { kind: 'composer' } } as any)
  v = await view($)
  expect(await v.text(/merge today/)).toBeFalsy()
  await v.close()
})

test('with nothing under way the estimate says it waits for the next step (the 18 minutes after Verify finished)', async ($, on) => {
  const clock = engine(on, { store: { 'dur:ci:me/app:total': [18 * 60000], 'seeded:me/app': true }, gh: x => (x.includes('nameWithOwner') ? 'me/app' : '{}') })
  await start($)
  await clock.advance(6000)
  await verify($)
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: '<task-notification><task-id>a1</task-id><status>completed</status></task-notification>' }] }, origin: { kind: 'task-notification' } } as any)
  const v = await view($)
  expect(await v.text(/Verify/)).toBe('✓ Verify')
  expect(await v.text(/18 min/)).toBe('~18 min of work left, once the next step starts')
  await v.close()
})

test('a running step with no history does not pose as a countdown (the 18 minutes that never moved)', async ($, on) => {
  const clock = engine(on, { LANG: 'zh_TW.UTF-8', store: { 'dur:ci:me/app:total': [18 * 60000], 'seeded:me/app': true }, gh: a => (a.includes('nameWithOwner') ? 'me/app' : '{}') })
  await start($)
  await clock.advance(6000)
  await verify($)
  const v = await view($)
  expect(await v.text(/^預計完成/)).toBe('預計完成：至少還要約 18 分（上機驗證還沒有歷史資料）')
  expect(await v.text(/寫程式/)).toBe('– 寫程式')
  expect(await v.text(/審查/)).toBe('– 審查')
  await v.close()
  // the band says the same: a floor, not a countdown
  expect(await band($)).toMatch(/^#128 \| [·✢✳✶✻✽] 上機驗證 \| ≥ 約 18 分$/)
})

test('in auto mode the band shows the ticket, the step, the time and your turn only while the pane is off screen', async ($, on) => {
  let shown = false
  engine(on, {
    LANG: 'zh_TW.UTF-8', store: { 'dur:stage:verify': [10 * 60000], bar: 'auto' },
    panes: () => [{ id: 'progress', title: '進度', isShown: shown, isFocused: false, isPlaced: shown }],
  })
  await start($)
  await verify($)
  await $.turn.complete(reply('要你決定：今天合併嗎？'))
  expect(await band($)).toMatch(/^#128 \| [·✢✳✶✻✽] 上機驗證 \| 約 10 分 \| 輪到你$/)
  shown = true
  expect(await band($)).toBe('ENGINE BAND')
})

test('red CI raises the alarm only when no work is running on it', async ($, on) => {
  const red = JSON.stringify({
    title: 'Fix login', state: 'OPEN', url: 'https://github.com/me/app/pull/5', headRefName: 'me/128-small-fixes',
    statusCheckRollup: [{ name: 'ci-gate', status: 'COMPLETED', conclusion: 'FAILURE', startedAt: '2025-01-06T09:00:00Z', completedAt: '2025-01-06T09:01:00Z' }],
  })
  const clock = engine(on, { gh: a => (a.includes('view') && a.includes('5') ? red : a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-x && gh pr view 5 --json state' })
  await $.tool.call({ tool: 'Bash', command: 'npm run ship', description: 'Wait for preflight then ship', run_in_background: true })
  await clock.advance(60000)
  let v = await view($)
  expect(await v.text(/^✕ CI$/)).toBe('✕ CI')
  expect(await v.text(/^(working|something broke)$/)).toBe('working')
  await v.close()
  // the background work ends and nothing else runs: now the red is the person's to see
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: '<task-notification><task-id>b1</task-id><status>completed</status></task-notification>' }] }, origin: { kind: 'task-notification' } } as any)
  await $.turn.complete(reply('Shipped.'))
  v = await view($)
  expect(await v.text(/^(working|something broke)$/)).toBe('something broke')
  await v.close()
})

// A rerun seconds after it began: the quick checks are queued, the long one still shows the last run's failure.
const RERUN = [
  { name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', startedAt: '2025-01-06T09:00:00Z', completedAt: '2025-01-06T09:01:20Z' },
  { name: 'ci-gate', status: 'COMPLETED', conclusion: 'FAILURE', startedAt: '2025-01-06T09:00:00Z', completedAt: '2025-01-06T09:01:30Z' },
  { name: 'changes', status: 'QUEUED', conclusion: '', startedAt: '2025-01-06T09:10:00Z', completedAt: '0001-01-01T00:00:00Z' },
  { name: 'ci-gate', status: 'QUEUED', conclusion: '', startedAt: '2025-01-06T09:10:10Z', completedAt: '0001-01-01T00:00:00Z' },
]

test('a failure from the run before a rerun waits for its own rerun instead of counting as failed', async () => {
  const states = Object.fromEntries(checksOf(latestRuns(RERUN)).map(c => [c.name, c.state]))
  expect(states).toEqual({ test: 'pending', 'ci-gate': 'pending', changes: 'pending' })
  // with no newer run, a failure is a failure
  expect(checksOf(latestRuns(RERUN.slice(0, 2))).map(c => c.state)).toEqual(['fail', 'fail'])
})

test('a run that has only queued its quick checks is estimated as a whole run, not as those checks', async ($, on) => {
  const view_ = JSON.stringify({ title: 'Fix login', state: 'OPEN', url: 'https://github.com/me/app/pull/5', headRefName: 'me/128-small-fixes', statusCheckRollup: RERUN })
  const clock = engine(on, {
    store: { 'dur:ci:me/app:total': [18 * 60000], 'dur:ci:me/app:changes': [6000], 'dur:ci:me/app:ci-gate': [6000], 'seeded:me/app': true },
    gh: a => (a.includes('view') && a.includes('5') ? view_ : a.includes('nameWithOwner') ? 'me/app' : '[]'),
  })
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-x && gh pr view 5 --json state' })
  await $.tool.call({ tool: 'Bash', command: 'npm run ship', description: 'Ship it', run_in_background: true })
  await clock.advance(60000)
  const v = await view($)
  expect(await v.text(/CI/)).toMatch(/^[·✢✳✶✻✽] CI/)
  // the run began at 09:10 and the mock clock is far past it: the floor is one minute, never the quick checks' six seconds
  expect(await v.text(/^Done in/)).toMatch(/^Done in ~\d+ min/)
  await v.close()
})

test('a ticket named with nothing under it gives way to the one whose PR is running', async ($, on) => {
  const running = JSON.stringify({ title: 'Small fixes', state: 'OPEN', url: 'https://github.com/me/app/pull/5', headRefName: 'me/128-small-fixes', statusCheckRollup: [{ name: 'test', status: 'IN_PROGRESS', conclusion: '', startedAt: '2025-01-06T09:10:00Z', completedAt: '0001-01-01T00:00:00Z' }] })
  const clock = engine(on, { gh: a => (a.includes('view') && a.includes('5') ? running : a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-small-fixes && gh pr view 5 --json state' })
  // a branch for the follow-up names a new ticket, but nothing runs under it yet
  await $.tool.call({ tool: 'Bash', command: 'git push -u origin me/130-follow-up' })
  await clock.advance(60000)
  let v = await view($)
  expect(await v.text(/^#1\d\d$/)).toBe('#128')
  await v.close()
  // once work starts under the new one, it is the current ticket
  await $.tool.call({ tool: 'Agent', description: 'Implement #130 follow-up', prompt: 'go', run_in_background: true } as any)
  v = await view($)
  expect(await v.text(/^#1\d\d$/)).toBe('#130')
  await v.close()
})

test('the band is on by default beside the pane, /progress bar off leaves it to the engine, and no pinned line is left', async ($, on) => {
  const lines: (string | undefined)[] = []
  engine(on, { LANG: 'zh_TW.UTF-8', store: { 'dur:stage:verify': [10 * 60000] }, status: lines,
    panes: () => [{ id: 'progress', title: '進度', isShown: true, isFocused: false, isPlaced: true }] })
  await start($)
  // the line 1.2.x pinned under the prompt is cleared at start
  expect(lines).toEqual([undefined])
  await verify($)
  expect(await band($)).toMatch(/^#128 \| [·✢✳✶✻✽] 上機驗證 \| 約 10 分$/)
  await $.command.run({ command: 'progress', args: 'bar off' } as any)
  expect(await band($)).toBe('ENGINE BAND')
  await $.command.run({ command: 'progress', args: 'bar always' } as any)
  expect(await band($)).toMatch(/^#128 \| /)
})

test('after the PR merges, an empty follow-up ticket does not take over, and has no estimate of its own', async ($, on) => {
  let state = 'OPEN'
  const pr = () => JSON.stringify({ title: 'Small fixes', state, url: 'https://github.com/me/app/pull/5', headRefName: 'me/128-small-fixes', statusCheckRollup: [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', startedAt: '2025-01-06T09:10:00Z', completedAt: '2025-01-06T09:28:00Z' }] })
  const clock = engine(on, { store: { 'dur:ci:me/app:total': [18 * 60000], 'seeded:me/app': true }, gh: a => (a.includes('view') && a.includes('5') ? pr() : a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-small-fixes && gh pr view 5 --json state' })
  await $.tool.call({ tool: 'Bash', command: 'git push -u origin me/130-follow-up' })
  state = 'MERGED'
  await clock.advance(60000)
  let v = await view($)
  expect(await v.text(/^#1\d\d$/)).toBe('#128')
  expect(await v.text(/^Done$/)).toBe('Done')
  await v.close()
})

test('a ticket with nothing under it shows no estimate', async ($, on) => {
  engine(on, { store: { 'dur:ci:me/app:total': [18 * 60000], 'seeded:me/app': true } })
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'git checkout -b me/130-follow-up' })
  const v = await view($)
  expect(await v.text(/^#130$/)).toBe('#130')
  expect(await v.text(/(Done|At least|work left)/)).toBeFalsy()
  await v.close()
})

test('a PR only looked at belongs to the ticket its own branch names, not to the one at hand', async ($, on) => {
  const old = JSON.stringify({ title: 'Brand colors', state: 'MERGED', url: 'https://github.com/me/app/pull/90', headRefName: 'me/90-brand', statusCheckRollup: [] })
  const clock = engine(on, { gh: a => (a.includes('view') && a.includes('90') ? old : a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await $.tool.call({ tool: 'Agent', description: 'Writer stage 1 for #132', prompt: 'go', run_in_background: true } as any)
  // read for reference while #132 is being written
  await $.tool.call({ tool: 'Bash', command: 'gh pr view 90 --json files' })
  // before the next poll reads its branch, the PR is no one's
  const early = await view($)
  expect(await early.text(/PR #90/)).toBeFalsy()
  await early.close()
  await clock.advance(60000)
  const v = await view($)
  expect(await v.text(/^#1\d\d$/)).toBe('#132')
  expect(await v.text(/^Done$/)).toBeFalsy()
  expect(await v.text(/Merge/)).toBe('○ Merge')
  expect(await v.text(/PR #90/)).toBeFalsy()
  await v.close()
})

test('a merged PR whose branch was never read is read once more, and leaves a ticket it never belonged to', async ($, on) => {
  let reply_ = JSON.stringify({ title: 'Brand colors', state: 'MERGED', url: 'https://github.com/me/app/pull/90', statusCheckRollup: [] })
  let polls = 0
  const clock = engine(on, { prUrl: 'https://github.com/me/app/pull/90', gh: a => (a.includes('view') && a.includes('90') ? (polls++, reply_) : a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await $.tool.call({ tool: 'Agent', description: 'Writer stage 1 for #132', prompt: 'go', run_in_background: true } as any)
  // what an older version did: the PR's link was taken as this ticket's own
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill', description: 'Open PR' } as any)
  await clock.advance(60000)
  expect(polls).toBe(1)
  let v = await view($)
  expect(await v.text(/PR #90/)).toBeTruthy()
  await v.close()
  // the reply then carried no branch: it is merged, and read again next time
  reply_ = JSON.stringify({ title: 'Brand colors', state: 'MERGED', url: 'https://github.com/me/app/pull/90', headRefName: 'me/90-brand', statusCheckRollup: [] })
  await clock.advance(60000)
  // read once more because its branch was unknown, then left alone
  expect(polls).toBe(2)
  await clock.advance(60000)
  expect(polls).toBe(2)
  v = await view($)
  expect(await v.text(/PR #90/)).toBeFalsy()
  await v.close()
})

test('a step running past its usual time says so instead of sitting at one minute left (the writer at 16 of 9 minutes)', async ($, on) => {
  const clock = engine(on, { LANG: 'zh_TW.UTF-8', store: { 'dur:stage:write': [9 * 60000], 'dur:ci:me/app:total': [18 * 60000], 'seeded:me/app': true }, gh: a => (a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await clock.advance(6000)
  await $.tool.call({ tool: 'Agent', description: 'Writer stage 1 for #132', prompt: 'go', run_in_background: true } as any)
  let v = await view($)
  expect(await v.text(/約剩/)).toBe('剛開始 · 約剩 9 分')
  await v.close()
  await clock.advance(16 * 60000)
  v = await view($)
  expect(await v.text(/平常/)).toBe('16 分 · 平常約 9 分')
  expect(await v.text(/約剩/)).toBeFalsy()
  expect(await v.text(/^預計完成/)).toBe('預計完成：至少還要約 18 分（寫程式比平常久）（另有 2 步還沒資料）')
  await v.close()
})

test('a finished step teaches the next one how long it takes', async ($, on) => {
  const clock = engine(on)
  await start($)
  await verify($)
  await clock.advance(7 * 60000)
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: '<task-notification><task-id>a1</task-id><status>completed</status></task-notification>' }] }, origin: { kind: 'task-notification' } } as any)
  await $.tool.call({ tool: 'Agent', description: 'Device verify #128 again', prompt: 'go', run_in_background: true } as any)
  const v = await view($)
  expect(await v.text(/min left/)).toBe('just started · ~7 min left')
  await v.close()
})

test('a scratch folder named like a ticket does not switch the ticket (a screenshots folder)', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'Agent', description: 'Writer stage 1 for #132', prompt: 'go', run_in_background: true } as any)
  await $.tool.call({ tool: 'Bash', command: 'cd /tmp/scratch/128-shots/ && sips -s format png a.png' })
  const v = await view($)
  expect(await v.text(/^#1\d\d$/)).toBe('#132')
  await v.close()
})

test('alone, a scratch folder named like a ticket names no ticket', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /tmp/scratch/128-shots/ && ls' })
  const v = await view($)
  expect(await v.text(/^#\d+$/)).toBeFalsy()
  expect(await v.text(/^Current ticket$/)).toBe('Current ticket')
  await v.close()
})

test('a real work tree named for a ticket names it', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/140-new-thing && git status' })
  const v = await view($)
  expect(await v.text(/^#1\d\d$/)).toBe('#140')
  await v.close()
})

test('a merged ticket with nothing running gives way to the ticket whose work runs', async ($, on) => {
  const merged = JSON.stringify({ title: 'Small fixes', state: 'MERGED', url: 'https://github.com/me/app/pull/5', headRefName: 'me/128-small-fixes', statusCheckRollup: [] })
  const clock = engine(on, { gh: a => (a.includes('view') && a.includes('5') ? merged : a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await $.tool.call({ tool: 'Agent', description: 'Writer stage 1 for #132', prompt: 'go', run_in_background: true } as any)
  // back in the merged ticket's tree for a last look
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-small-fixes && gh pr view 5 --json state' })
  await clock.advance(60000)
  const v = await view($)
  expect(await v.text(/^#1\d\d$/)).toBe('#132')
  await v.close()
})

test('a command with no description is shown by what it does', async () => {
  expect(labelOf('cd /w/128-x && npm run ci:local')).toBe('npm run ci:local')
  expect(labelOf('U=814BD3D6-6579; S=/tmp/x; xcrun simctl io $U screenshot $S/a.png')).toBe('xcrun simctl io $U screenshot $S/a.png')
  expect(labelOf('cd "/a b/c" && W=1 && make build')).toBe('make build')
  expect(labelOf('git status')).toBe('git status')
})

test('the pane lists a background command with no description by what it does', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-x && U=ABC; xcrun simctl io $U screenshot shot.png', run_in_background: true } as any)
  const v = await view($)
  expect(await v.text(/simctl/)).toMatch(/xcrun simctl io/)
  expect(await v.text(/cd \/w/)).toBeFalsy()
  await v.close()
})

test('a red preflight while work still runs counts the coming full run in the estimate', async ($, on) => {
  const red = JSON.stringify({ title: 'Brand', state: 'OPEN', url: 'https://github.com/me/app/pull/5', headRefName: 'me/128-brand', statusCheckRollup: [{ name: 'ci-gate', status: 'COMPLETED', conclusion: 'FAILURE', startedAt: '2025-01-06T09:10:00Z', completedAt: '2025-01-06T09:11:00Z' }] })
  const clock = engine(on, { store: { 'dur:ci:me/app:total': [18 * 60000], 'seeded:me/app': true }, gh: a => (a.includes('view') && a.includes('5') ? red : a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-brand && gh pr view 5 --json state' })
  await $.tool.call({ tool: 'Bash', command: 'npm run ship', description: 'Wait preflight, ship, then CI', run_in_background: true })
  await clock.advance(60000)
  let v = await view($)
  expect(await v.text(/^✕ CI$/)).toBe('✕ CI')
  expect(await v.text(/18 min/)).toMatch(/~18 min/)
  await v.close()
  // with nothing running the red stands alone: no run is coming
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: '<task-notification><task-id>b1</task-id><status>completed</status></task-notification>' }] }, origin: { kind: 'task-notification' } } as any)
  await $.turn.complete(reply('Done for now.'))
  v = await view($)
  expect(await v.text(/18 min/)).toBeFalsy()
  await v.close()
})

test('with nothing under way the band says it waits for the next step', async ($, on) => {
  const clock = engine(on, { LANG: 'zh_TW.UTF-8', store: { 'dur:ci:me/app:total': [18 * 60000], 'seeded:me/app': true }, gh: a => (a.includes('nameWithOwner') ? 'me/app' : '[]') })
  await start($)
  await clock.advance(6000)
  await $.tool.call({ tool: 'Bash', command: 'git checkout -b me/128-x' })
  await verify($)
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: '<task-notification><task-id>a1</task-id><status>completed</status></task-notification>' }] }, origin: { kind: 'task-notification' } } as any)
  expect(await band($)).toBe('#128 | 等下一步・約 18 分 | 輪到你')
})

test('above the prompt the pane is a few plain lines, beside the transcript the full cards', async ($, on) => {
  engine(on, { LANG: 'zh_TW.UTF-8', store: { 'dur:stage:verify': [10 * 60000] } })
  await start($)
  await verify($)
  await $.turn.complete(reply('要你決定：今天合併嗎？'))
  const inline = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, placement: 'inline' } })
  expect((await inline.find({ type: 'Text', text: /^#128$/ }))?.text).toBe('#128')
  expect((await inline.find({ type: 'Text', text: /上機驗證.*CI.*合併/ }))?.text).toMatch(/寫程式 · .*上機驗證 · .*CI · .*合併$/)
  expect((await inline.find({ type: 'Text', text: /今天合併/ }))?.text).toMatch(/^輪到你\s+今天合併嗎？$/)
  // no cards: the card-only headings are absent
  expect(await inline.find({ type: 'Text', text: /^背景工作$/ })).toBeFalsy()
  await inline.unmount()
  const dock = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await dock.find({ type: 'Text', text: /^背景工作$/ }))?.text).toBe('背景工作')
  await dock.unmount()
})

// ── motion ───────────────────────────────────────────────────────

test('a background command is filed by its own description, not by words in the command', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-x && git log --grep=review -1 && npm run build && npm run ci:local', description: 'Run full local CI and typecheck', run_in_background: true })
  const v = await view($)
  expect(await v.text(/Verify/)).toMatch(/^[·✢✳✶✻✽] Verify$/)
  expect(await v.text(/Write/)).toBe('– Write')
  await v.close()
})

test('a task is shown under the step its shown name says, whatever was stored for it', async ($, on) => {
  engine(on)
  await start($)
  // no description: it is shown, and was stored, by the command's first 40 characters,
  // but the stored step came from the whole command, which ends in a word for Review
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-x && npm run ci:local --workspace=app && git log --grep=review -1', run_in_background: true } as any)
  const v = await view($)
  expect(await v.text(/Verify/)).toMatch(/^[·✢✳✶✻✽] Verify$/)
  expect(await v.text(/Review/)).toBe('– Review')
  await v.close()
})

test('every spark frame is 7 columns wide, so the card never jumps', async () => {
  for (const mood of ['work', 'ask', 'idle', 'fail', 'done'] as const)
    for (let f = 0; f < 32; f++) for (const line of sparkFor(mood, f)) expect([mood, f, line.length]).toEqual([mood, f, 7])
  expect(sparkFor('work', 0)[0]).not.toBe(sparkFor('work', 1)[0])
})

test('the spinner turns with the clock, /progress still freezes it, /progress move brings it back', async ($, on) => {
  const clock = engine(on)
  await start($)
  await verify($)
  const glyphs = async () => {
    const v = await view($)
    const task = (await v.text(/Device/)) ?? ''
    const step = (await v.text(/Verify/)) ?? ''
    await v.close()
    return [task[0], step[0]]
  }
  expect(await glyphs()).toEqual(['·', '·'])
  await clock.advance(250)
  expect(await glyphs()).toEqual(['✢', '✢'])
  await $.command.run({ command: 'progress', args: 'still' } as any)
  expect(await glyphs()).toEqual(['✻', '✻'])
  await clock.advance(1000)
  expect(await glyphs()).toEqual(['✻', '✻'])
  await $.command.run({ command: 'progress', args: 'move' } as any)
  const before = await glyphs()
  await clock.advance(250)
  expect(await glyphs()).not.toEqual(before)
})
