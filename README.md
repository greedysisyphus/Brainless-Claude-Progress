# Brainless Claude Progress

A progress pane for [Claude Code](https://claude.com/claude-code). It sits beside the chat and answers the questions you keep asking: *how far along is it, how long until it's done, and is it waiting on me?*

```
#128                                   │
add dark mode                        ─ ✶ ─
working                                │

✓ Write
✶ Review                  12 min · ~6 min left
○ Verify
✶ CI ▰▰▰▱▱▱                 3/6 · ~9 min left
○ Merge                              PR #131
Done in ~21 min (1 step without history yet)

Background                          2 running
✶ Code review                          12 min
✶ Device verify #128             just started

Your turn
Accept the two trade-offs?
```

## What it shows

- **The current ticket and its steps.** Write → Review → Verify → CI → Merge, each marked done, running or not started.
- **CI status** of the ticket's pull request, polled with the GitHub CLI once a minute. A check that failed on an earlier push of the same commit no longer shows as failed once it has been re-run.
- **Time estimates that learn.** Every step remembers how long it took (the last 10 runs). CI time is read from your repository's last 10 merged pull requests on first use, so the very first ticket already has a CI estimate. Steps with no history yet say so instead of guessing; while one of them is running, the estimate is shown as a floor (*at least ~N min more*) rather than a countdown that cannot move.
- **Background work.** Subagents and background shell commands, with how long each has been running.
- **Your turn.** When a reply hands a decision back to you, the pane shows it until you answer, even if more replies come in between.
- **A one-line bar above the prompt**: `#128 ✻ Verify · ~10 min · Your turn`, always on by default; `/progress bar auto` shows it only while the pane is hidden.
- **Compact when there is no room to dock.** In a narrow terminal the pane sits above the prompt as two or three plain lines (ticket and steps, time left, your turn) instead of three cards.
- Animated with Claude's own spark (✢ ✳ ✶ ✻ ✽) while work runs; still when nothing does.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install brainless-claude-progress --marketplace greedysisyphus/Brainless-Claude-Progress
```

From a shell:

```
claude plugin install brainless-claude-progress --marketplace greedysisyphus/Brainless-Claude-Progress
```

Answer `y` to add the marketplace, then pick a scope. The pane opens by itself in a wide terminal; in a narrow one, type `/progress`.

**Needs:** Claude Code with mods (built and tested on 2.1.308; the mod API is early access and may change). The [GitHub CLI](https://cli.github.com) signed in, for CI status and estimates. Without it everything else still works.

## Commands

| Command | Does |
| --- | --- |
| `/progress` | Open the pane |
| `/progress still` / `/progress move` | Turn the animation off / on (remembered) |
| `/progress bar always` · `auto` · `off` | The one-line bar above the prompt: always, only while the pane is hidden, or never (remembered) |
| `/progress lang en` · `zh-Hant` · `zh-Hans` · `ja` | Pick the pane's language (remembered) |
| `/progress lang auto` | Go back to choosing it automatically |

## Languages

English, 繁體中文, 简体中文 and 日本語. Unless you pick one, the pane uses, in order:

1. Claude Code's `language` setting, if set;
2. the language you write your messages in (kana → Japanese; simplified or traditional characters → the matching Chinese);
3. your system's `$LANG`;
4. English.

## How it recognises things

It reads only what Claude Code already sees; it sends nothing anywhere except `gh` calls to GitHub for your own pull requests.

- **The ticket** comes from places that say what the work is: an agent's task name (`Device verify #128`, `Review PROJ-42`), the git work tree a command `cd`s into (`…/128-small-fixes`; a plain folder such as `…/128-shots` does not count), a branch a command creates or pushes (`claude/731-dark-mode`, `feature/PROJ-9-search`), or `gh issue develop 412`. Viewing, commenting on or closing an issue does not switch to it. A number that merely appears inside a command, such as in a file being written, is ignored.
- **The step** comes from the task's name, in any of the four languages: *review / 審查 / 审查 / レビュー*, *verify / test / QA / 驗證 / 验证 / 検証*, *implement / fix / 寫 / 写 / 実装*. A task named otherwise is listed under Background without a step.
- **The pull request** is one the conversation opened (the link printed by `gh pr create` or `git push`), or one it looks at with `gh pr …` whose own branch or title names the ticket. A PR read only for reference does not mark the current ticket merged.
- **"Your turn"** is a reply that has a heading such as *Decision needed*, *Action required*, *要你決定*, *需要你决定*, *ご判断ください*; or, without one, a reply whose last paragraph is a question. It clears when you send your next message.

## Limits

- A step done outside this conversation (another terminal, another tool) is not seen, so it stays `○`.
- Estimates are medians of your own history; the first few runs of a step have none.
- Uppercase keys that look like tickets but are not (`UTF-8`, `SHA-256`, `ISO-8601`) are filtered out; an unusual one may still slip through.

## Development

```
claude plugin validate .
claude plugin test .
```

The tests run against the engine itself and cover every language, the ticket and step rules, CI history per repository (using a real check rollup in `hooks/ci-fixture.ts`), and the animation frame by frame on a mock clock.

---

## 中文說明

Claude Code 的進度面板，放在聊天旁邊，回答你最常問的三件事：**做到哪了、還要多久、是不是在等我。**

- **目前的票和步驟**：寫程式 → 審查 → 上機驗證 → CI → 合併，每一步標示完成、進行中或還沒開始。
- **CI 燈號**：每分鐘用 GitHub CLI 查一次這張票的 PR。同一顆 commit 先前跑紅、後來重跑過的檢查，不會再被當成失敗。
- **會學習的預計時間**：每一步記住最近 10 次實際花的時間；CI 第一次使用時會從 repo 最近 10 張合併的 PR 讀歷史，所以第一張票就有 CI 的預估。沒有資料的步驟會直接說「還沒資料」，不會亂猜。
- **背景工作**：子代理和背景指令，以及各跑了多久。
- **輪到你**：回覆把決定交給你時，面板會一直顯示，直到你回話為止。
- **輸入框上方的進度列**：一行摘要 `#128 ✻ 上機驗證 · 約 10 分 · 輪到你`，預設一直顯示；`/progress bar auto` 只在面板沒顯示時出現，`/progress bar off` 關閉。

安裝：在 Claude Code 終端機輸入

```
/plugin install brainless-claude-progress --marketplace greedysisyphus/Brainless-Claude-Progress
```

指令：`/progress` 打開面板；`/progress still`／`move` 關閉／打開動畫；`/progress lang zh-Hant`（或 `en`、`zh-Hans`、`ja`、`auto`）指定語言。沒有指定時，依序看 Claude Code 的語言設定、你打字用的語言、系統語言，最後才用英文。

## License

MIT
