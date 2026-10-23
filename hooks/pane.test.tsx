import { expect, mock, test } from 'claude-code/testing'

import { SAMPLE_ROLLUP } from './ci-fixture'
import { askOf, detectLang, normalizeLang, STRINGS } from './i18n'
import { ciTotal, latestRuns, mostOf, sparkFor, stageOf, ticketOfCommand, ticketOfName } from './register'

const PANE = {
  plugin: 'brainless-claude-progress', component: 'Pane', requestId: 'progress',
  props: { title: 'Progress', isFocused: false, bodyColumns: 44, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

// the engine beneath the mod, as each test needs it
function engine(on: any, opts: { history?: string[]; agents?: unknown[]; store?: Record<string, unknown>; LANG?: string; language?: string; gh?: (argv: string[]) => string } = {}) {
  mock.store(on, opts.store ?? {})
  mock.env(on, { LANG: opts.LANG ?? 'en_US.UTF-8' })
  const clock = mock.clock(on)
  on('settings.read', () => ({ value: opts.language ? { language: opts.language } : {} }))
  on('command.register', () => ({ value: { command: 'progress' } }))
  on('command.run', (_: any, e: any) => ({ text: e.args }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/' }))
  on('session.messages', () => ({ value: (opts.history ?? []).map(text => ({ role: 'user', text, toolUses: [] })) }))
  on('agent.list', () => ({ value: opts.agents ?? [] }))
  on('turn.complete', (_: any, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }))
  on('process.run', (_: any, e: any) => ({
    value: { exitCode: opts.gh ? 0 : 1, stdout: opts.gh?.(e.argv) ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('tool.call', (_: any, e: any) =>
    e.tool === 'Agent'
      ? { result: { status: 'async_launched', agentId: 'a1' } }
      : { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: e.run_in_background ? 'b1' : undefined } })
  return clock
}
const start = ($: any) => $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
const reply = (answer: string) => ({ answer, durationMs: 1, isAborted: false, turnId: answer.slice(0, 20), reason: 'end_turn' }) as any
const verify = ($: any, name = 'Device verify #128') =>
  $.tool.call({ tool: 'Agent', description: name, prompt: 'go', run_in_background: true })
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
  expect(ticketOfCommand('gh issue view 412')).toBe('#412')
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
      : argv.includes('list') ? JSON.stringify([{ statusCheckRollup: SAMPLE_ROLLUP }]) : '{}',
    store: { 'dur:ci:other/site:total': [2 * 60000] },
  })
  await start($)
  await verify($)
  let v = await view($)
  expect(await v.text(/^Done/)).toBe('Done in: still learning, needs a few finished runs')
  await v.close()

  await clock.advance(6000)
  v = await view($)
  // me/app's 17 minutes, not other/site's 2
  expect(await v.text(/^Done/)).toBe('Done ~17 min after Verify finishes')
  await v.close()

  // a PR in the other repository is estimated from that repository's own history
  await $.tool.call({ tool: 'Bash', command: 'gh pr view 5 -R other/site --json state' })
  v = await view($)
  expect(await v.text(/^Done/)).toBe('Done ~2 min after Verify finishes')
  await v.close()
})

// ── the pane ─────────────────────────────────────────────────────

test('the ticket, a learned estimate, a task and a waiting decision, drawn on two surfaces', async ($, on) => {
  engine(on, { store: { 'dur:stage:verify': [10 * 60000] } })
  await start($)
  await verify($)
  await $.tool.call({ tool: 'Bash', command: 'cd /w/128-x && codex exec review', description: 'Wait for Codex review', run_in_background: true })
  await $.turn.complete(reply('Done.\n\n**Decision needed:** Accept the two trade-offs?'))
  for (const surface of ['terminal', 'desktop'] as const) {
    const v = await view($, surface)
    expect(await v.text(/^#128$/)).toBe('#128')
    expect(await v.text(/~10 min left/)).toContain('just started')
    // review runs with no history, so the count starts when it ends; write, unseen before it, is not waited for
    expect(await v.text(/^Done/)).toBe('Done ~10 min after Review finishes (1 step without history yet)')
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
  // the person's own words through Remote Control do count
  await $.prompt.submit({ text: 'ok go ahead and merge it today please', origin: { kind: 'bridge' } } as any)
  v = await view($)
  expect(await v.text(/^Background$/)).toBe('Background')
  expect(await v.text(/今天合併/)).toBeFalsy()
  await v.close()
})

test('the starting language is the one most recent messages are in, ties to the latest', async () => {
  expect(mostOf(['zh-Hant', 'zh-Hant', 'en'])).toBe('zh-Hant')
  expect(mostOf(['en', 'zh-Hant'])).toBe('zh-Hant')
  expect(mostOf([])).toBeUndefined()
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
  expect(await v.text(/^預計完成/)).toBe('預計完成：上機驗證做完後再約 18 分')
  expect(await v.text(/寫程式/)).toBe('– 寫程式')
  expect(await v.text(/審查/)).toBe('– 審查')
  await v.close()
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
