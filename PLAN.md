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

## The instruction builder

The instruction builder is how Surface constructs prompts for AI writes. It's a three-layer system that stacks context from general to specific, so the model always gets the right instructions for the project without the user writing prompts by hand.

### The three layers

```
┌─────────────────────────────────────────────────┐
│  Layer 1 — App Framework (built-in default)     │
│  How to make precise edits to source files.     │
│  Ships with Surface. Viewable + editable in UI. │
├─────────────────────────────────────────────────┤
│  Layer 2 — Styling System (auto-detected)       │
│  How to write for this project's styling        │
│  system. Auto-loaded, editable in UI.           │
├─────────────────────────────────────────────────┤
│  Layer 3 — Project (user-authored)              │
│  Your team's patterns: helpers, token files,    │
│  naming conventions, what to never touch.       │
│  Created and edited through Surface UI.         │
└─────────────────────────────────────────────────┘
```

All three layers are **visible and editable through the Surface UI**. Layers 1 and 2 ship with sensible defaults. Layer 3 starts empty. The user can customise any layer to match their project.

**Layer 1 — App Framework** (built-in default)

Teaches the model the mechanics of making precise source edits:
- Make only the change requested
- Never reformat surrounding code
- Preserve existing patterns and whitespace
- Handle JSX, SFC (Astro/Svelte), and standard HTML

Ships with Surface as the default. Most users never need to touch it, but it's visible in the UI and editable if a project has unusual needs (e.g. a non-standard file format or a monorepo with generated code that needs special handling).

**Layer 2 — Styling System** (auto-detected, editable)

Surface already detects the project's styling system (Tailwind v3/v4, CSS) during startup. In AI mode, this detection loads the matching instruction set:

```markdown
# Tailwind v4

Edit className props using Tailwind utility classes.
Use scale values from the design system: p-4 is 16px, p-6 is 24px.
Prefer design system tokens over arbitrary values like p-[23px].
For responsive changes, use breakpoint prefixes: md:, lg:, xl:.
```

Surface ships defaults for supported styling systems. The UI shows which one was auto-detected and lets users edit it — useful for projects that use Tailwind with custom conventions, or a styling system Surface doesn't have a built-in default for.

**Layer 3 — Project** (user-authored via UI)

The project's own conventions. This is where teams encode decisions that are specific to their codebase. It's a free-text field — the user can be as detailed or as brief as they like:

```markdown
# Project conventions

Use cn() from @/lib/utils for class composition.
Color tokens live in globals.css — prefer those over raw values.
Don't touch variant definitions unless explicitly asked.
Components live in src/components/, kebab-case filenames.
```

Or, if the project already has conventions captured in `CLAUDE.md`, Layer 3 can simply reference it:

```markdown
Follow conventions in CLAUDE.md
```

This works because `claude -p` automatically reads the project's `CLAUDE.md` — Surface doesn't need to inline its contents. Layer 3 is supplementary to whatever the user already has there. Teams that have invested in their `CLAUDE.md` get that value for free in AI writes.

Created and edited through the Surface UI. This is the layer that makes AI writes feel like they were written by someone on the team, not a generic model.

### Managing instructions through the UI

The instruction builder UI lives in the Surface editor panel (visible when AI mode is active). It shows all three layers as an expandable stack:

```
┌─────────────────────────────────────────────┐
│  AI Write Instructions                      │
│                                             │
│  ▸ Layer 1 — App Framework          built-in│
│  ▾ Layer 2 — Tailwind v4       auto-detected│
│  ┌─────────────────────────────────────────┐│
│  │ Edit className props using Tailwind ... ││
│  │ Use scale values: p-4 is 16px, ...     ││
│  │ [Reset to default]                      ││
│  └─────────────────────────────────────────┘│
│  ▸ Layer 3 — Project               editable │
│                                             │
│  [+ Add instruction]                        │
└─────────────────────────────────────────────┘
```

- **Expand/collapse** each layer to view and edit its content
- **Reset to default** on layers 1 and 2 restores the shipped version
- **Layer 3** starts with a placeholder that guides the user on what to add
- Edits are saved to a `.surface/instructions.json` file in the project root (or similar), checked into the repo so the whole team shares them
- The prompt preview (Phase 2) shows the fully assembled prompt from all layers, so users can see exactly what the model will receive

### How the layers compose into a prompt

At write time, the instruction builder stacks all three layers together with the visual edit context from the editor:

```
[LAYER 1 — App Framework]
Make only the change requested.
Never reformat surrounding code.
Preserve existing patterns and whitespace.

[LAYER 2 — Styling System — Tailwind v4]
Edit className props using Tailwind utility classes.
Use scale values: p-4 is 16px, p-6 is 24px.
Prefer design system tokens over arbitrary values.

[LAYER 3 — Project]
Use cn() from @/lib/utils for class composition.
Color tokens live in globals.css, prefer those.
Don't touch variant definitions unless asked.

[CHANGE]
File: src/components/page-header.tsx
Element at line 23 col 4 (data-source="src/components/page-header.tsx:23:4")

Current className: "flex items-center gap-4 px-6 py-3"
Change: padding-top and padding-bottom to 24px
```

The `[CHANGE]` block is what the visual editor builds from user interactions — the same UI controls that exist today, but serialised as structured intent rather than passed to a write adapter.

### What the editor contributes to the change block

Every visual control exists to eliminate ambiguity in the change description:

| Visual control | Prompt contribution |
|---|---|
| Element selection (click) | `data-source` → exact file, line, column |
| Current style readout | "Current className includes `py-3` (12px)" |
| Design token picker | "Change to `py-6` (24px)" — never raw values |
| Slider / numeric input | Exact target value from the design system scale |
| Color picker | Exact token name, not hex |
| Cross-file awareness | Includes relevant files (parent layout, token defs) as context |

The prompt is surgical because the visual editor built it — not because the user typed it.

### Where instructions are stored

- **Defaults** (Layer 1, Layer 2) ship inside the `surface` package as markdown files
- **User edits** (all layers) are saved to `.surface/instructions.json` in the project root, checked into git so the whole team shares them
- If no config exists, Surface works fine with just the built-in defaults. Layer 3 is what takes it from "good for any project" to "good for *this* project."

### Relationship to CLAUDE.md

Surface **never reads or writes the project's `CLAUDE.md`**. That file belongs to the user and may already contain instructions for interactive Claude Code sessions, CI workflows, or other tooling.

However, `claude -p` automatically reads `CLAUDE.md` on every invocation — Surface doesn't need to do anything special for this. This means:

- **Surface's instruction layers are supplementary.** Layers 1-2 add visual-editing-specific guidance (precise edits, styling system conventions). Layer 3 adds project-specific context. All of this stacks on top of whatever's already in `CLAUDE.md`.
- **Users who've invested in `CLAUDE.md` get that value for free.** Their existing coding conventions, architectural decisions, and project context automatically inform AI writes without any duplication.
- **Layer 3 can be minimal.** If `CLAUDE.md` already covers project conventions, Layer 3 might just say "Follow conventions in CLAUDE.md" — or add only the visual-editing-specific bits that `CLAUDE.md` doesn't cover.

Surface owns Layers 1-2 and the `[CHANGE]` block. `CLAUDE.md` provides the ambient project context. They compose naturally because `claude -p` sees both.

---

## Container runtime (ooda / Sprites)

### How ooda works

[ooda](https://github.com/nichochar/ooda-cli) launches Claude Code on cloud dev environments powered by Sprites.dev. A Sprite is a full Linux container with your codebase, a shell, and Claude Code pre-installed and authenticated. You connect via `npx ooda-cli` from any terminal — Claude gets full TTY pass-through. Sprites expose ports via public URLs for previewing running apps.

### The topology

Everything runs inside the Sprite. The local machine connects via `sprite proxy`, which proxies multiple local ports to the Sprite's ports in a single command.

```
┌── Your laptop ────────────────────────────────┐
│                                               │
│  sprite proxy -s SPRITE 4400 3000             │
│                                               │
│  Browser                                      │
│    └── http://localhost:4400  (editor UI)     │
│          └── iframes :3000   (dev server)     │
│                                               │
└───────────────────────────────────────────────┘
        │
        │  sprite proxy (multi-port)
        │
┌── Sprite (cloud container) ───────────────────┐
│                                               │
│  npm run dev              → :3000             │
│  npx designsurface        → :4400             │
│  claude (interactive TTY via ooda)            │
│                                               │
│  Surface Editor Server (:4400)                │
│         │                                     │
│   [mode toggle]                               │
│     /         \                               │
│  Deterministic   AI Writes                    │
│  (adapter)       (prompt builder)             │
│     │                │                        │
│  file write    claude -p --model sonnet "..." │
│     │                │                        │
│     └──── file on disk ──────┘                │
│              │                                │
│         HMR picks up → iframe reloads         │
│                                               │
│  CLAUDE.md (conventions for AI mode)          │
└───────────────────────────────────────────────┘
```

### Why this is clean

- **No new server.** The Surface editor server (Express on :4400) already exists. AI mode adds a new code path inside the existing `/api/write-element` endpoint (or a sibling `/api/ai-write`). No separate write API, no new port.
- **No network hops for writes.** `claude -p` is a subprocess on the same machine as the files. The editor server spawns it, waits for exit, reads stdout.
- **No auth for the write path.** Claude CLI is already authenticated in the Sprite (ooda handles this via `ANTHROPIC_API_KEY` or OAuth). The Surface server doesn't need its own auth layer — it's all localhost inside the container.
- **Coexists with interactive Claude.** ooda gives you a TTY session to Claude Code for conversational use. Surface spawns separate `claude -p` calls (stateless, prompt-in → edit-out). These are independent processes that just read/write files — no conflict.
- **`sprite proxy` handles multi-port access.** `sprite proxy -s SPRITE 4400 3000` proxies both ports to localhost in a single command. Supports `local:remote` syntax if local ports need to differ. No public URLs required — everything stays local.

### Setup inside a Sprite

```bash
# Inside the Sprite (via ooda TTY)
npm run dev &                  # starts on :3000
npx designsurface              # starts on :4400, iframes :3000
```

```bash
# On your local machine
sprite proxy -s SPRITE_NAME 4400 3000
```

Then open `http://localhost:4400` in your browser. That's it.

For a single-command setup, a project could add a script:

```json
{
  "scripts": {
    "surface": "npm run dev & npx designsurface --port 3000"
  }
}
```

### What about local development?

The same topology works locally too — `npx designsurface` runs on your machine, spawns `claude -p` as a subprocess. The only difference is where Claude CLI is installed (globally on your machine vs pre-installed in the Sprite). No code changes needed to support both environments.

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
- The assembled prompt from all three instruction layers + change block
- Which files are included as context
- Which Layer 3 sections (from CLAUDE.md) apply
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
| Project conventions | Hard-coded detection heuristics | Instruction layers — configured in UI |
| Offline / air-gapped | Fully local | Needs local model in container |
| Auditability | Obvious git diff | Still git diff |
| Editor complexity | Complex — owns the write | Simple — just builds prompts |
| User control | Predictable, constrained | Flexible, needs review |

---

## Implementation sequence

### Phase 1 — Instruction builder + mode toggle + write path

1. **Instruction layers** — author Layer 1 (app framework) and Layer 2 defaults (Tailwind v4, CSS) as markdown files shipped inside the `surface` package. Wire up config loading (`.surface/instructions.json`) for user overrides and Layer 3 content.
2. **Instruction builder** — server-side module that composes all three layers + the change block into a single prompt string. This is the core of AI writes — everything else feeds into or consumes the output of this module.
3. **Instruction management UI** — expandable panel in the editor showing all three layers. Users can view, edit, and reset layers 1-2 to defaults. Layer 3 has a guided empty state. Edits save to `.surface/instructions.json` in the project root.
4. **Add write mode state** to the editor — `"deterministic" | "ai"` toggle in the toolbar, model selector (Sonnet/Opus) visible when AI is active.
5. **Batch pending changes** — when AI mode is active, visual edits accumulate as a list of change intents (live-previewed in iframe as today). "Apply" serialises them into the `[CHANGE]` block for the instruction builder.
6. **Wire up `claude -p --model <model>`** — editor server passes the assembled prompt to Claude CLI as a subprocess. Captures stdout for the change summary. Works identically local or in a Sprite — always a local subprocess call.
7. **Loading overlay** — covers the iframe while Claude is working. Shows model name and a spinner.
8. **HMR pickup** — after Claude exits, dev server HMR reloads the iframe. Editor re-scans `data-source` attributes.
9. **Change summary** — parse Claude's stdout summary, verify against actual file diff, display in a summary bar with Undo and View Diff actions.

Deterministic mode is completely unchanged. The toggle just determines which code path runs when the user commits. No separate "container integration" phase — the editor server already runs next to the files and Claude CLI in both local and Sprite environments.

### Phase 2 — Polish

10. **Undo button** — one-click revert for AI writes (`git checkout -- <files>`)
11. **Write log** — session-level history of all writes (mode, model, prompt, files changed, timestamp) for multi-step undo
12. **Prompt preview panel** — expandable, collapsed by default. Shows the assembled prompt from all three instruction layers + change block, context files, model. For debugging and power users.
13. **Prompt tuning** — iterate on instruction layer content based on real-world accuracy across stacks

---

## Open questions

- **Confidence threshold**: Should the editor warn when a prompt seems too vague or the change too large for a single AI write? Or just let Claude try and show the diff?
- **Deterministic fallback in AI mode**: If the user is in AI mode but the change is trivially simple (one className value), should the editor suggest switching to deterministic? Or is that the kind of auto-routing we're explicitly avoiding?
- **Summary format**: JSON from Claude's stdout is parseable but fragile. Should we use a more structured approach (e.g. tool_use output format) or is stdout + diff verification enough?
- **Batching limits**: How many changes should be batchable in a single prompt? At some point the prompt gets too large or too ambiguous. Should there be a soft limit with a warning?
