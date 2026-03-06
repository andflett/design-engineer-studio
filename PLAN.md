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
  body: { mode: "ai" | "deterministic", prompt?: string, ...adapterPayload? }
  → returns: { status, filesChanged: string[] }

GET  /files/:path
  → returns file content (for editor to re-read after write)

WS   /write/stream
  → streams Claude CLI output for progress indication
```

**Port exposure:**
- Container platform provides a tunnel URL (e.g. `https://<id>-<port>.ooda.computer`)
- Write API requires token auth (generated at container start, passed to local editor)
- Optional: WebSocket for streaming Claude's output during longer writes

---

## Change visibility

### Before the write (AI mode only)
- **Prompt preview**: expandable panel showing the exact prompt that will be sent. User can see what Claude will be asked to do before it happens.
- **Context list**: which files are included as context, which CLAUDE.md sections apply.
- **Mode badge**: visible indicator — "AI Write" or "Deterministic" — so it's always clear what's about to happen.

### After the write (both modes)
- Editor detects file change (fs watcher in-container, API poll for remote)
- Visual preview updates to show the new state
- Minimal change summary: `py-3 → py-6 in page-header.tsx`
- Git diff available as ground truth for any write

### Undo
- AI writes: `git checkout -- <file>` reverts. Editor wraps this as a one-click "Undo" button.
- Deterministic writes: existing undo mechanism stays as-is.
- Future: maintain a write log (mode, prompt, files changed, timestamp) for session-level undo history.

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

1. **Add write mode state** to the editor — `"deterministic" | "ai"` toggle in the toolbar
2. **When AI mode is active**, the existing visual controls (sliders, pickers, etc.) build a structured prompt object instead of calling a write adapter
3. **Prompt preview panel** — show the assembled prompt before sending
4. **Wire up `claude -p`** — editor server spawns Claude CLI with the prompt, waits for completion
5. **File re-read** — after Claude exits, re-read the changed file(s) and update the visual preview

Deterministic mode is completely unchanged. The toggle just determines which code path runs when the user commits a visual change.

### Phase 2 — Container integration

6. **Write API server** — thin HTTP layer that accepts write requests from a remote editor, dispatches to either mode
7. **Auth** — token-based, generated at container start
8. **Port exposure** — configure for ooda.computer tunnel
9. **WebSocket streaming** — optional, for progress indication on AI writes

### Phase 3 — Polish

10. **Undo button** — one-click revert for AI writes (`git checkout`)
11. **Write log** — session-level history of all writes (mode, prompt, files, timestamp)
12. **CLAUDE.md scaffolding** — helper to generate an initial CLAUDE.md from detected project stack
13. **Prompt tuning** — iterate on prompt structure based on real-world accuracy across stacks

---

## Open questions

- **Streaming preview**: Should the editor show Claude's output as it streams (partial file content appearing), or wait for completion? Streaming feels more responsive but partial state could be confusing.
- **Multi-file writes**: Some changes naturally span files (e.g. extracting a component). In AI mode Claude can handle this. How does the editor represent a multi-file prompt and multi-file result?
- **Confidence threshold**: Should the editor warn when a prompt seems too vague or the change too large for a single AI write? Or just let Claude try and show the diff?
- **Model selection**: Container has Claude CLI, but which model? Should the user be able to pick (Sonnet for speed, Opus for complex changes)? Or just use whatever's configured?
- **Deterministic fallback in AI mode**: If the user is in AI mode but the change is trivially simple (one className value), should the editor suggest switching to deterministic? Or is that the kind of auto-routing we're explicitly avoiding?
