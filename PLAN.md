# AI Write Modes — Implementation Plan

## Premise

Surface's visual editor currently writes changes via deterministic plugins — one per framework × styling system combo. That stays. It works, it's fast, it's precise.

This plan adds a **second write mode: AI Writes**. The user explicitly chooses which mode before editing. AI mode turns the visual editor into a prompt builder — it constructs a precise, structured prompt from visual interactions, then hands it to Claude CLI, which writes directly to disk.

The two modes are peers. Neither replaces the other.

---

## The two modes

### Mode 1 — Deterministic (existing, unchanged)

```
Code Plugin → Visual Editor → Write Adapter → file on disk
```

- One adapter per framework × styling system
- Byte-perfect output, < 50ms
- AST-level edits preserve formatting
- Works offline, zero inference
- **This is the current system. No changes needed.**

### Mode 2 — AI Writes (new)

```
Code Plugin → Visual Editor (prompt builder) → Claude CLI → file on disk
```

- Visual editor builds a structured prompt from the same UI controls
- Claude CLI (`claude -p`) receives the prompt and edits the file directly
- Handles any stack — no adapter required
- Seconds latency, probabilistic
- Guided by project `CLAUDE.md` for conventions

**Key insight:** In AI mode, the editor doesn't write anything. It doesn't receive file content back. It doesn't apply diffs. Claude CLI owns the write. The editor's only job is to make the prompt as precise as possible, then re-read the file after Claude is done.

---

## Mode selection UX

The user chooses a write mode **before they start editing**. This is an explicit toggle, not a hidden router.

- Toggle lives in the editor panel header/toolbar
- Two states: **Deterministic** / **AI**
- Persists per session (or per project if stored in settings)
- Default: Deterministic (existing behavior, zero surprise)
- When AI mode is selected, the editor UI can show additional context (prompt preview, CLAUDE.md status)
- When deterministic mode is selected for an unsupported stack, show a nudge: "No adapter for [stack] — try AI mode?"

This is similar to how [Vercel AI Elements](https://vercel.com/changelog/introducing-ai-elements) treats AI as composable UI — the mode toggle is a first-class component in the editor chrome, not buried in settings.

### Model selector (AI mode only)

When AI mode is active, a secondary dropdown lets the user choose which model Claude CLI uses:

- **Sonnet** (default) — fast, good for single-property changes
- **Opus** — slower, better for complex multi-file or reasoning-heavy edits

The selection is passed to Claude CLI via `--model` flag: `claude -p --model sonnet "..."`. Persists per session. The model name appears in the prompt preview and change summary so the user always knows what ran.

---

## What the editor contributes to the prompt

The visual editor's value in AI mode is **prompt precision**. Every visual control exists to eliminate ambiguity:

| Visual control | Prompt contribution |
|---|---|
| Element selection (click) | `data-source` → exact file, line, column |
| Current style readout | "Current className includes `py-3` (12px)" |
| Design token picker | "Change to `py-6` (24px)" — never raw values |
| Slider / numeric input | Exact target value from the design system scale |
| Color picker | Exact token name, not hex |
| Cross-file awareness | Includes relevant files (parent layout, token defs) as context |

### Assembled prompt example

```
File: src/components/page-header.tsx
Element: line 23, col 4 (data-source="src/components/page-header.tsx:23:4")

Current className: "flex items-center gap-4 px-6 py-3"
Change: padding-top and padding-bottom from 12px to 24px

Project uses Tailwind v4. Use utility classes from the design system scale.
Use cn() from @/lib/utils for class composition.
```

Claude CLI gets this and makes a single, precise edit. The prompt is surgical because the visual editor built it — not because the user typed it.

---

## CLAUDE.md as the convention layer

The original ai-writes proposal had three "skill" tiers. In this model, two of those collapse into what Claude CLI already reads:

| Original skill tier | AI Writes equivalent |
|---|---|
| Base skill (make minimal edits, don't reformat) | Built into Claude — it already does this |
| Styling system skill (Tailwind scales, utilities) | Section in project `CLAUDE.md` |
| Project skill (helpers, tokens, conventions) | Section in project `CLAUDE.md` |

No custom skill format. No skill file registry. Teams write a `CLAUDE.md` in their repo root (which they may already have) and it guides AI writes automatically.

```markdown
# CLAUDE.md (example)

## Styling
Tailwind v4. Prefer design system tokens over arbitrary values.
Spacing: p-1=4px, p-2=8px, p-3=12px, p-4=16px, p-6=24px, p-8=32px.

## Conventions
- Use cn() from @/lib/utils for class merging
- Color tokens defined in globals.css — use those, don't invent new ones
- Never modify variant definitions unless explicitly asked
- Components in src/components/, kebab-case filenames
```

---

## Container runtime (ooda.computer)

### Topology A — Editor runs inside the container

```
┌─── Container ─────────────────────────────────┐
│                                               │
│  Browser UI ←→ Surface Editor Server          │
│                       │                       │
│                 [mode toggle]                  │
│                   /       \                    │
│          Deterministic   AI Writes             │
│          (adapter)       (prompt builder)      │
│              │                │                │
│          file write      claude -p "..."       │
│              │                │                │
│              └───── file on disk ─────┘        │
│                                               │
│  CLAUDE.md (conventions for AI mode)          │
└───────────────────────────────────────────────┘
```

Everything local. Claude CLI is pre-installed in the container. No port exposure needed for the write path. The editor server spawns `claude -p` as a subprocess.

### Topology B — Local editor, container is remote

```
┌── Local machine ───┐      ┌─── Container ──────────────────┐
│                    │      │                                │
│  Surface Editor    │─────▶│  Write API (:port)             │
│  (VS Code / app)   │◀─────│     │                          │
│                    │      │     ├── Deterministic adapter   │
└────────────────────┘      │     │      → file write         │
                            │     │                          │
                            │     └── AI mode                │
                            │            → claude -p "..."    │
                            │            → file write         │
                            │                                │
                            │  CLAUDE.md                     │
                            └────────────────────────────────┘
```

The Write API is thin:

```
POST /write
  body: { mode: "ai" | "deterministic", model?: string, prompt?: string, ...adapterPayload? }
  → returns: { status, filesChanged: string[], summary: string }

GET  /files/:path
  → returns file content (for editor to re-read after write)
```

**Port exposure:**
- Container platform provides a tunnel URL (e.g. `https://<id>-<port>.ooda.computer`)
- Write API requires token auth (generated at container start, passed to local editor)

---

## Edit → batch → write cycle

The user edits visually in the iframe as they do today. The editor live-previews changes as normal. The difference is what happens when they commit.

### The flow

1. **User makes edits** — sliders, pickers, drag handles. The iframe live-previews each change as it happens (existing behavior, unchanged).
2. **User hits "Apply"** — the editor batches all pending changes into a single structured prompt.
3. **Loading overlay** — a loading state covers the iframe. The prompt is sent to Claude CLI.
4. **Claude writes to disk** — files change on the filesystem. Claude CLI also returns a **change summary** (natural language description of what it did and which files it touched).
5. **HMR / re-scan** — the dev server's HMR picks up the file changes, the iframe reloads. The editor re-scans `data-source` attributes and updates its model of the page.
6. **Summary shown** — the editor displays Claude's change summary alongside the updated preview. For multi-file changes, this is how the user knows what happened beyond the visible iframe.

```
┌─────────────────────────────────────────────────┐
│  User drags padding from 12px → 24px            │
│  User changes color from gray-500 → gray-700    │
│  (iframe live-previews both)                     │
│                                                  │
│  [Apply]                                         │
├─────────────────────────────────────────────────┤
│  ░░░░░░░░░░░ Loading ░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░ Sending to Claude CLI... ░░░░░░░░░░░░░░░  │
├─────────────────────────────────────────────────┤
│  ✓ Changed 2 properties in page-header.tsx      │
│    · py-3 → py-6 (padding-y: 12px → 24px)      │
│    · text-gray-500 → text-gray-700              │
│                                                  │
│  [Undo]  [View diff]                            │
└─────────────────────────────────────────────────┘
```

### Getting the summary back from Claude CLI

Claude CLI writes files directly, but we also need it to return a structured summary. Two approaches:

**Approach A — Prompt instructs Claude to print a summary after editing**

The prompt ends with:
```
After making the changes, print a JSON summary:
{ "files": ["path", ...], "changes": ["description", ...] }
```

Claude CLI's stdout (`-p` mode) captures this. The editor parses the JSON from stdout after the process exits.

**Approach B — Diff-based summary**

Before invoking Claude, snapshot the relevant files (or their mtimes). After Claude exits, diff the before/after. Generate the summary from the diff itself — no need for Claude to describe what it did.

Approach A is simpler and gives richer descriptions. Approach B is more reliable (can't hallucinate a summary). **Recommendation: use both.** Capture Claude's stdout summary for the human-readable description, but verify against the actual file diff for the file list and change locations.

### Multi-file changes

The prompt can reference multiple files when the editor detects cross-file relationships (e.g. a component and its token source). Claude naturally edits across files.

The change summary is how the user learns about files they can't see in the iframe. The summary lists every file touched:

```
✓ Changed 2 files
  · src/components/page-header.tsx — py-3 → py-6
  · src/styles/tokens.css — added --spacing-header: 24px
[View diff]
```

The "View diff" button shows a git diff panel (or opens the container's terminal / VS Code diff view).

### Prompt preview (before write)

Before the user hits "Apply", an expandable panel shows:
- The assembled prompt (what Claude will be asked to do)
- Which files are included as context
- Which CLAUDE.md sections apply
- The selected model

This is collapsed by default — most users won't need it. Power users and debugging sessions benefit from seeing exactly what's being sent.

### Undo

- **One-click undo**: `git checkout -- <files>` reverts all files from the last AI write. Editor wraps this as an "Undo" button in the change summary bar.
- **Deterministic writes**: existing undo mechanism stays as-is.
- **Write log**: session-level history of all writes (mode, prompt, files changed, timestamp) enables undo of any previous write, not just the last one.

---

## Trade-offs

| Dimension | Deterministic | AI Writes |
|---|---|---|
| Write reliability | Byte-perfect | Probabilistic — precise prompts mitigate |
| Stack coverage | Supported combos only | Any stack |
| Latency | < 50ms | Seconds |
| Cross-file edits | Hard — explicit code per pattern | Natural — model sees all context |
| Novel patterns | Falls back / fails | Handles gracefully |
| Project conventions | Hard-coded detection heuristics | CLAUDE.md — written once |
| Offline / air-gapped | Fully local | Needs local model in container |
| Auditability | Obvious git diff | Still git diff |
| Editor complexity | Complex — owns the write | Simple — just builds prompts |
| User control | Predictable, constrained | Flexible, needs review |

---

## Implementation sequence

### Phase 1 — Mode toggle + prompt builder (editor side)

1. **Add write mode state** to the editor — `"deterministic" | "ai"` toggle in the toolbar, model selector (Sonnet/Opus) visible when AI is active
2. **Batch pending changes** — when AI mode is active, visual edits accumulate as a list of change intents (live-previewed in iframe as today). "Apply" batches them into one prompt.
3. **Prompt builder** — assembles the structured prompt from batched changes, `data-source` locations, current values, target values, and CLAUDE.md context
4. **Wire up `claude -p --model <model>`** — editor server spawns Claude CLI with the prompt. Captures stdout for the change summary.
5. **Loading overlay** — covers the iframe while Claude is working. Shows model name and a spinner.
6. **HMR pickup** — after Claude exits, dev server HMR reloads the iframe. Editor re-scans `data-source` attributes.
7. **Change summary** — parse Claude's stdout summary, verify against actual file diff, display in a summary bar with Undo and View Diff actions.

Deterministic mode is completely unchanged. The toggle just determines which code path runs when the user commits.

### Phase 2 — Container integration

8. **Write API server** — thin HTTP layer that accepts write requests (including model choice) from a remote editor, dispatches to either mode, returns change summary
9. **Auth** — token-based, generated at container start
10. **Port exposure** — configure for ooda.computer tunnel

### Phase 3 — Polish

11. **Undo button** — one-click revert for AI writes (`git checkout -- <files>`)
12. **Write log** — session-level history of all writes (mode, model, prompt, files changed, timestamp) for multi-step undo
13. **Prompt preview panel** — expandable, collapsed by default. Shows assembled prompt, context files, CLAUDE.md sections, model. For debugging and power users.
14. **CLAUDE.md scaffolding** — helper to generate an initial CLAUDE.md from detected project stack
15. **Prompt tuning** — iterate on prompt structure based on real-world accuracy across stacks

---

## Open questions

- **Confidence threshold**: Should the editor warn when a prompt seems too vague or the change too large for a single AI write? Or just let Claude try and show the diff?
- **Deterministic fallback in AI mode**: If the user is in AI mode but the change is trivially simple (one className value), should the editor suggest switching to deterministic? Or is that the kind of auto-routing we're explicitly avoiding?
- **Summary format**: JSON from Claude's stdout is parseable but fragile. Should we use a more structured approach (e.g. tool_use output format) or is stdout + diff verification enough?
- **Batching limits**: How many changes should be batchable in a single prompt? At some point the prompt gets too large or too ambiguous. Should there be a soft limit with a warning?
