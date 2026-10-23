export type Stage = 'write' | 'review' | 'verify' | 'other'

export type BgTask = {
  id: string
  label: string
  kind: 'agent' | 'bash'
  stage: Stage
  ticket?: string
  /** 0 when it started before the pane was watching: its age is unknown */
  startedAt: number
  doneAt?: number
  status?: string
}

export type CheckRun = { name: string; state: 'pending' | 'pass' | 'fail'; startedAt?: number }

export type PrWatch = {
  number: number
  repo?: string
  cwd: string
  ticket?: string
  /** the PR's own branch, once a poll has read it */
  branch?: string
  title?: string
  state?: string
  checks: CheckRun[]
  polledAt?: number
}

export type Turn = 'working' | 'asking' | 'idle'

/** an item of Claude's own to-do list (TodoWrite, or TaskCreate and TaskUpdate) */
export type Todo = { id: string; text: string; status: 'pending' | 'in_progress' | 'completed' }

/** '' while the language is still worked out ('auto') */
export type LangPick = '' | 'en' | 'zh-Hant' | 'zh-Hans' | 'ja'

declare module 'claude-code' {
  interface PluginState {
    'brainless-claude-progress': {
      bg: BgTask[]
      prs: PrWatch[]
      turn: Turn
      now: number
      ask: string
      ticket: string
      frame: number
      still: boolean
      /** what the person chose with /progress lang; '' for auto */
      langPick: LangPick
      /** auto: Claude Code's language setting, else the person's own writing, else $LANG */
      langAuto: LangPick
      /** the repository the session runs in, owner/name; '' until known */
      repo: string
      /** languages of the person's last ten messages */
      said: ('en' | 'zh-Hant' | 'zh-Hans' | 'ja')[]
      /** the band above the prompt: always, only while the pane is hidden, or never */
      bar: 'always' | 'auto' | 'off'
      /** Claude's to-do list, as its last TodoWrite or Task calls left it */
      todos: Todo[]
      /** the main loop's latest tool call: its own description (tool '') or a tool and what it works on; text '' between turns */
      doing: { tool: string; text: string }
      /** when the main loop's current turn started; 0 between turns */
      turnAt: number
      /** the folder and branch the session runs in, shown where no ticket is known */
      place: string
    }
  }
}
