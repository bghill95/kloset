# How Professionals Use Claude Code in 2025–2026 — With a Deep Dive on Boris Cherny's Workflow

*Research compiled 2026-06-10. Sources prioritized from 2025–2026; verification status flagged for all Boris Cherny attributions.*

---

## 1. Boris Cherny's Workflow (Creator of Claude Code, Anthropic)

Boris Cherny has documented his setup repeatedly across 2026 in X threads, starting with the canonical January 2026 thread: *"I'm Boris and I created Claude Code. Lots of people have asked how I use Claude Code, so I wanted to show off my setup a bit. My setup might be surprisingly vanilla! Claude Code works great out of the box, so I personally don't customize it much."* ([x.com/bcherny/status/2007179832300581177](https://x.com/bcherny/status/2007179832300581177) — opening verified verbatim from the post itself; full thread contents corroborated across [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/), [Karo Zieminski's annotated breakdown](https://karozieminski.substack.com/p/boris-cherny-claude-code-workflow), and [a community tip compilation](https://www.anup.io/35-claude-code-tips-from-the-guy-who-built-it/)).

### 1.1 Massively parallel sessions ("multi-clauding")

- **What he does:** Runs **5 Claude Code instances in terminal tabs** (numbered 1–5, with OS notifications for when a session needs input) plus **5–10 more sessions on claude.ai/code**, each in a separate git checkout/worktree so edits don't collide. He also kicks off sessions from his phone in the morning and picks them up at his desk. ✅ *Verified — from his own Jan 2026 thread, corroborated by [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/).*
- **Notable detail:** He told Gergely Orosz he ships **20–30 PRs per day** this way, and says the job skill has shifted from deep focus to *"how good I am at context switching and jumping across multiple different contexts very quickly."* ✅ *Verified — direct interview, [The Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny).*
- **Worktrees:** Later in 2026 he described running **3–5 git worktrees at once with shell aliases (`za`, `zb`, `zc`) to hop between them**, including a dedicated worktree just for reading logs/running BigQuery, and announced built-in `--worktree` support: *"Now, agents can run in parallel without interfering with one another."* ✅ *Verified — [x.com/bcherny/status/2025007393290272904](https://x.com/bcherny/status/2025007393290272904) (Feb 2026); alias detail corroborated by [the aggregator site](https://howborisusesclaudecode.com/) and [tip compilations](https://www.anup.io/35-claude-code-tips-from-the-guy-who-built-it/).*
- **Solo application:** Start with two worktrees — one for your main feature, one "read-only" session for questions/log-digging — before scaling to 3–5. Use `claude --worktree <name>` and OS notifications so you only context-switch when a session actually needs you.

### 1.2 Plan mode first… later replaced by auto mode

- **Original practice (Jan–Feb 2026):** *"If my goal is to write a Pull Request, I will use Plan mode, and go back and forth with Claude until I like its plan"* — then switch to auto-accept edits and let Claude run. He told Pragmatic Engineer: *"once there is a good plan, it will one-shot the implementation almost every time."* ✅ *Verified — Jan thread via [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/) + direct quote in [Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny).*
- **Evolution (May–June 2026):** His stated #1 tip changed: *"These days my #1 tip is: use auto mode. Auto mode means no more permission prompts. It is the key building block for multi-clauding: start a session, then while it runs, work on another session…"* and in a one-year retrospective with Cat Wu he covers *"why I use auto mode instead of plan mode, how routines fix bugs before I see them, why I do most of my coding from my phone now."* ✅ *Verified — [x.com/bcherny/status/2058519809214607704](https://x.com/bcherny/status/2058519809214607704) and [x.com/bcherny/status/2064034799711588805](https://x.com/bcherny/status/2064034799711588805).*
- **Solo application:** Use plan mode (shift+tab twice) for anything multi-file or unfamiliar; iterate on the plan, then release Claude in auto-accept/auto mode. As you build trust and a verification harness, shift routine work to auto mode so permission prompts stop being your bottleneck.

### 1.3 Verification loops — "the most important thing"

- **What he says:** *"Probably the most important thing to get great results out of Claude Code — give Claude a way to verify its work. If Claude has that feedback loop, it will 2-3x the quality of the final result."* For UI work, his Claude uses the Chrome extension to test changes in a browser and iterate. ✅ *Verified — Jan 2026 thread, quoted consistently by [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/), [Zieminski](https://karozieminski.substack.com/p/boris-cherny-claude-code-workflow), and [howborisusesclaudecode.com](https://howborisusesclaudecode.com/).*
- **Solo application:** Before delegating a task, decide what the pass/fail check is — a test command, a build, a screenshot diff — and put it in the prompt: "run X after implementing and iterate until it passes."

### 1.4 CLAUDE.md as compounding team memory

- **What he does:** One shared CLAUDE.md per repo, checked into git (~2.5k tokens at the time of the thread), updated by the team multiple times a week: *"Anytime we see Claude do something incorrectly we add it to the CLAUDE.md."* During code review he tags `@.claude` on PRs to fold learnings into the file as part of the PR itself. ✅ *Verified — Jan thread via [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/).*
- **Later evolution:** Reportedly his habit became: *"Every single time Claude makes a mistake, I don't tell it to do it differently. I tell it to write it to the CLAUDE.md, or make a skill… If you can do this, then Claude can just run forever."* ⚠️ *Secondhand — attributed to a June 2026 post by the [aggregator site](https://howborisusesclaudecode.com/); consistent with his verified philosophy but I could not read the underlying post directly.*
- **Solo application:** End every session where Claude stumbled with "update CLAUDE.md so you don't make that mistake again." Prune the file regularly — rules compound, bloat dilutes.

### 1.5 Slash commands, subagents, permissions, and tooling

- **Slash commands:** For anything done more than ~once a day — *"Claude and I use a /commit-push-pr slash command dozens of times every day"* — stored in `.claude/commands/`, checked into git, with inline bash to pre-compute things like `git status`. ✅ *Verified — Jan thread via [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/).*
- **Subagents:** Defined in `.claude/agents/` as PR-workflow automations — e.g., `code-simplifier`, `verify-app` — plus tips like appending "use subagents" to fan out exploration. ✅ *Verified — Jan thread; a community mirror of his published config exists at [github.com/0xquinto/bcherny-claude](https://github.com/0xquinto/bcherny-claude) (commands like `/commit-push-pr`, `/techdebt`, `/grill`; agents like `code-simplifier`, `verify-app`, `staff-reviewer`). Note the repo itself is a third-party reconstruction.*
- **Permissions:** He avoids `--dangerously-skip-permissions`; instead uses `/permissions` to pre-allow safe commands, shared via `.claude/settings.json`. ✅ *Verified — Jan thread via [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/).*
- **Model:** Opus (4.5 at the time) with thinking *"for every task… since you have to steer it less and it's better at tool use, it is almost always faster"* overall. ✅ *Verified — Jan thread.*
- **Tool integrations:** Slack via MCP, BigQuery via `bq` CLI, Sentry logs; `.mcp.json` checked into git. Voice dictation (*"you speak 3x faster than you type, and your prompts get way more detailed"*) and Ghostty terminal with a custom status line showing context usage + branch. ⚠️ *Mostly verified via the thread compilations ([anup.io](https://www.anup.io/35-claude-code-tips-from-the-guy-who-built-it/)); dictation/Ghostty details are consistently reported but read through aggregators, not the original posts.*
- **Interviews for context:** On the [Latent Space podcast](https://www.latent.space/p/claude-code) (with Cat Wu) he said roughly **80–90% of Claude Code's own code is written by Claude** (with human review), described prototyping UIs by pasting screenshots and iterating with Puppeteer MCP until output matched mockups, and framed his personal gain as ~2x ([detailed notes at vlad.build](https://vlad.build/cc-pod/), [officechai summary](https://officechai.com/ai/80-of-claude-codes-code-is-written-by-claude-code-anthropic-lead-engineer/)). He also appeared on [Lenny's Podcast, Feb 19 2026](https://www.lennysnewsletter.com/p/head-of-claude-code-what-happens) (paywalled — could not extract specifics).

---

## 2. Official Anthropic Guidance

The canonical source is now the **[Best Practices guide on the Claude Code docs](https://code.claude.com/docs/en/best-practices)** (successor to the April 2025 [engineering blog post](https://www.anthropic.com/engineering/claude-code-best-practices)). Its core ideas:

- **Context is the fundamental constraint.** Everything — every file read, command output — fills the context window, and performance degrades as it fills. Hence: `/clear` between unrelated tasks, `/compact <instructions>` for controlled summarization, subagents for context-heavy research, and a status line to watch usage.
- **Give Claude a way to verify its work** (mirrors Boris's #1 tip), with an escalation ladder: verification criteria in the prompt → `/goal` conditions re-checked every turn → **Stop hooks** as deterministic gates → an adversarial **verification subagent** in fresh context. Have Claude *show evidence* (test output, screenshots), not assert success.
- **Explore → Plan → Implement → Commit.** Use plan mode to separate research from execution; press Ctrl+G to edit the plan directly. But skip planning when "you could describe the diff in one sentence."
- **CLAUDE.md discipline:** `/init` to bootstrap; keep it short ("Would removing this cause Claude to make mistakes? If not, cut it"); bloated files cause Claude to ignore instructions; move occasional knowledge into **skills** (loaded on demand) instead.
- **Extension layers, each with a role:** [hooks](https://code.claude.com/docs/en/best-practices) for things that must happen *every time* (deterministic, unlike advisory CLAUDE.md rules); **skills** (`.claude/skills/<name>/SKILL.md`) for domain knowledge and invocable workflows like `/fix-issue 1234`; **subagents** (`.claude/agents/`) for isolated-context delegation; **plugins** to bundle all of these; **MCP servers** for external tools — with a note that plain CLI tools (`gh`, `aws`, `sentry-cli`) are often the most context-efficient integration.
- **"Let Claude interview you"** for larger features: have Claude ask structured questions via AskUserQuestion, write a SPEC.md, then execute in a fresh session.
- **Scale-out patterns:** headless `claude -p` for CI/scripts; fan-out loops over file lists with `--allowedTools` scoping; Writer/Reviewer dual-session patterns; worktrees, the desktop app, web sessions, and **agent teams** for coordinated parallelism; **auto mode** (classifier-reviewed permissions) for unattended runs.

Other official sources worth knowing: **[How Anthropic teams use Claude Code](https://www.anthropic.com/news/how-anthropic-teams-use-claude-code)** (every team — including lawyers and marketers — uses it; product engineering calls it their "first stop" for any task), and **[Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)** (covered in §4).

**Solo application:** Adopt the docs' failure-pattern checklist directly — `/clear` after two failed corrections, prune CLAUDE.md ruthlessly, never ship what you can't verify, and scope investigations to subagents so exploration doesn't poison your main context.

---

## 3. Popular Community Techniques (2025–2026)

### 3.1 The Superpowers plugin (skills-driven SDLC)
Jesse Vincent's (obra) **[Superpowers](https://github.com/obra/superpowers)** became the most popular Claude Code plugin and is in the official marketplace. It packages a full methodology as auto-triggering skills: brainstorming → written plan → git-worktree isolation → **subagent-driven development** (fresh subagent per task with two-stage review) → strict **red/green TDD** (watch the test fail first) → code review → merge options. [Simon Willison praised it](https://simonwillison.net/2025/Oct/10/superpowers/) as a milestone in agent methodology, noting the core doc is under 2k tokens and skills act as "mandatory workflows, not suggestions" ([Jesse's original post](https://blog.fsck.com/2025/10/09/superpowers/)). **Solo use:** `/plugin marketplace add obra/superpowers-marketplace` then install — you get a disciplined senior-engineer process without building it yourself.

### 3.2 Plan-then-execute with persistent markdown artifacts
A widely-shared variant (e.g., [Boris Tane — no relation — Feb 2026](https://boristane.com/blog/how-i-use-claude-code/)): never let Claude code until you've approved a written plan; have it produce `research.md` and `plan.md` files, then **annotate the plan inline** ("don't implement yet") over several cycles before a standardized implementation prompt. The markdown becomes shared mutable state you can edit in your editor — more control than chat. **Solo use:** for any 2+ hour feature, demand a plan file, mark it up, and only then say "implement, checking off tasks as you go, run typecheck continuously."

### 3.3 Hooks for deterministic automation
Community consensus ([ofox.ai guide](https://ofox.ai/blog/claude-code-hooks-subagents-skills-complete-guide-2026/), [smartscope](https://smartscope.blog/en/generative-ai/claude/claude-code-best-practices-advanced-2026/)): use **PostToolUse hooks** to auto-format after every edit (Boris's team does this to avoid CI style failures), **PreToolUse hooks** to block writes to protected paths, and **Stop hooks** to gate session end on tests passing. **Solo use:** ask Claude itself — "write a hook that runs eslint after every file edit" — per the official docs.

### 3.4 The Ralph Wiggum loop (autonomous overnight runs)
Geoffrey Huntley's *"Ralph is a Bash loop"* — `while true` re-feeding a prompt file so the agent iterates against tests until done — became famous enough that **Anthropic shipped it as an official plugin** using a Stop hook to intercept exit and restart ([anthropics/claude-code ralph-wiggum plugin](https://github.com/anthropics/claude-code/blob/main/plugins/ralph-wiggum/README.md), [origin story](https://devinterrupted.substack.com/p/inventing-the-ralph-wiggum-loop-creator), [technique writeup](https://paddo.dev/blog/ralph-wiggum-autonomous-loops/)). Huntley ran a 3-month loop that built an entire programming language; YC hackathon teams shipped 6+ repos overnight for ~$297. **Solo use:** only with a near-perfect verifier (test suite) and sandboxed permissions — the loop amplifies whatever your checks miss.

### 3.5 Headless mode and CI
`claude -p` runs the full agent loop non-interactively with `--output-format json|stream-json`, `--max-turns`, and `--allowedTools` scoping; the official `anthropics/claude-code-action` wraps it for GitHub Actions. Common uses: automated PR review (~$0.03 and under a minute for a 500-line diff per [one playbook](https://www.codewithseb.com/blog/claude-code-headless-mode-cicd-automation-playbook)), issue triage, doc generation, and `@claude` mentions on PRs ([hidekazu-konishi guide](https://hidekazu-konishi.com/entry/claude_code_cicd_and_headless_automation.html)). **Solo use:** add the GitHub Action so "@claude fix this" works on your own issues, and pipe logs through `claude -p` for analysis.

### 3.6 MCP servers people actually use
2026 roundups converge on a small set: **GitHub** (highest-impact single install), **Playwright** (browser verification — the engine behind UI feedback loops), **Context7** (current library docs), **Sentry**, plus database servers (Postgres/Supabase) and team tools (Slack, Linear, Figma) ([codersera](https://codersera.com/blog/best-mcp-servers-claude-code-cursor-2026/), [Firecrawl](https://www.firecrawl.dev/blog/best-mcp-servers-for-developers), [Bannerbear](https://www.bannerbear.com/blog/8-best-mcp-servers-for-claude-code-developers-in-2026/)). Advice repeated everywhere: **3–6 servers max** — each adds context overhead, and CLIs often beat MCP for context efficiency. **Solo use:** GitHub + Playwright + one project-specific server; check `.mcp.json` into git.

### 3.7 Voice, phone, and "AI as capacity you schedule"
Boris's dictation tip spread widely, as did the framing (from [Zieminski's analysis](https://karozieminski.substack.com/p/boris-cherny-claude-code-workflow)) that pros treat Claude not as a tool you use but as **capacity you schedule** — allocate it, queue it, keep it hot, switch contexts only when value is ready.

---

## 4. Agent Orchestration Patterns

### 4.1 Subagent fan-out (orchestrator + workers, results-only)
The base pattern: main session delegates research/review to subagents that burn their own context and return summaries. Best for **focused tasks where only the result matters** — codebase investigation, edge-case review, adversarial diff review — at the lowest token cost ([official sub-agents docs](https://code.claude.com/docs/en/sub-agents), [orchestration guide](https://hidekazu-konishi.com/entry/claude_code_subagents_and_orchestration_guide.html)). **Solo use:** append "use subagents to investigate X" before implementing, and "use a subagent to review this diff against the plan; report gaps, not style preferences" after.

### 4.2 Agent teams (lead + communicating teammates)
Now built into Claude Code (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`): a **team lead** spawns teammates with their own full sessions, a **shared task list** with file-locked claiming and dependencies, and **direct inter-agent messaging** ([agent teams docs](https://code.claude.com/docs/en/agent-teams)). Official guidance on when to use which: subagents when workers just report back; teams when workers must *discuss* — e.g., **competing-hypothesis debugging** ("spawn 5 teammates to disprove each other's theories like a scientific debate"), parallel multi-lens code review (security/perf/tests), and cross-layer features. Best practices: 3–5 teammates, 5–6 tasks each, **each teammate owns different files**, require plan approval for risky work, and enforce gates with `TeammateIdle`/`TaskCompleted` hooks. **Solo use:** start with research/review teams (no code conflicts) before parallel implementation.

### 4.3 Leaderless swarms at scale — the C compiler case study
Anthropic's most-cited orchestration writeup ([Building a C compiler with parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)): **16 agents, ~2,000 sessions over two weeks, ~$20k**, produced a 100k-line Rust C compiler that builds Linux 6.9. Architecture was deliberately dumb: a bash loop per agent, a shared git repo, and agents claiming tasks by creating files in `current_tasks/` — git conflicts naturally prevent duplicate work. Lessons that generalize: **the verifier must be nearly perfect**; tests must produce LLM-readable output; parallelism requires task independence (the monolithic kernel build stalled everyone until they used GCC as an oracle to shard the problem); agent specialization (dedup, perf, docs, design-critique agents) beats homogeneous workers; concise logs prevent context pollution.

### 4.4 Dynamic Workflows (June 2026)
Anthropic's newest answer to "when do I fan out?": a research-preview feature where **Claude writes its own orchestration script** — decomposes the objective, runs subtasks in parallel, validates results before answering, with resumable progress ([InfoQ, June 2026](https://www.infoq.com/news/2026/06/dynamic-workflows-claude-code/), [alexop.dev on deterministic orchestration](https://alexop.dev/posts/claude-code-workflows-deterministic-orchestration/)). Targeted at migrations, security audits, and widespread bug hunts; warned to be token-hungry.

### 4.5 When to fan out vs. stay single-threaded
Community + official consensus ([agent teams docs](https://code.claude.com/docs/en/agent-teams), [Addy Osmani's "Code Agent Orchestra"](https://addyosmani.com/blog/code-agent-orchestra/), [Shipyard's 2026 survey](https://shipyard.build/blog/claude-code-multi-agent/)):

| Stay single-threaded | Fan out (subagents) | Fan out (teams/worktrees) |
|---|---|---|
| Sequential logic, same-file edits, heavy interdependencies | Research, review, verification — results-only work | Independent features, multi-lens review, competing hypotheses |
| Deep context accumulating value | Main context must stay clean | Tasks are file-disjoint and parallel exploration adds value |

The recurring human-side pattern, straight from Boris: parallelism is bounded by *your* review bandwidth and verification quality, not by how many agents you can spawn — he abandons 10–20% of his parallel sessions ([InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)).

---

## Verification Summary for Boris Cherny Claims

| Claim | Status |
|---|---|
| Jan 2026 setup thread (5 terminal + 5–10 web sessions, plan mode, CLAUDE.md, /commit-push-pr, Opus w/ thinking, /permissions, verification 2–3x) | ✅ His own thread; opening verified verbatim, contents cross-confirmed by 4+ independent writeups |
| "Auto mode is my #1 tip" / multi-clauding | ✅ Verified verbatim from [his X post](https://x.com/bcherny/status/2058519809214607704) |
| Built-in worktree support announcement | ✅ Verified verbatim from [his X post](https://x.com/bcherny/status/2025007393290272904) |
| 80–90% of Claude Code written by Claude; 2x personal gain; Puppeteer screenshot loops | ✅ Direct interview ([Latent Space](https://www.latent.space/p/claude-code)) |
| 20–30 PRs/day; "one-shot the implementation"; context-switching as the new skill | ✅ Direct interview ([Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny)) |
| `za`/`zb`/`zc` aliases, dictation "3x faster," Ghostty, "write mistakes to CLAUDE.md so Claude can run forever," minimal-prompt philosophy | ⚠️ Reported by [howborisusesclaudecode.com](https://howborisusesclaudecode.com/) and [tip compilations](https://www.anup.io/35-claude-code-tips-from-the-guy-who-built-it/) citing dated X posts that could not be fetched directly (X paywalled); consistent with his verified posts but technically secondhand |
| The `bcherny-claude` config repo | ⚠️ Third-party reconstruction of his shared config, not his own repo ([github.com/0xquinto/bcherny-claude](https://github.com/0xquinto/bcherny-claude)) |

**The one-line synthesis:** the people best at Claude Code in 2026 — starting with its creator — converge on the same loop: *plan (or spec) first, give the agent a verifier it can run itself, encode every mistake into persistent memory (CLAUDE.md/skills), automate repetition (slash commands/hooks), and then parallelize with worktrees and agents only as far as your verification and review bandwidth can support.*
