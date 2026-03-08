# Multiplayer Exploration

Early thinking on multiplayer collaboration. Not on the roadmap yet, but captured here so current architecture decisions don't accidentally block it.

## Why the Overlay Approach (Option 2) Would Make Multiplayer Harder

Each user has their own overlay instance injected into their own iframe. Syncing cursor positions and selections means coordinating overlay state across clients, but the overlays are tightly coupled to each user's viewport scroll position, window size, and DOM state. If user A scrolls and user B doesn't, the "Alice is looking at this element" indicator has no meaningful target.

## Why the Web App Approach (Option 1) Is More Natural

The Surface API server on the Sprite is already the single source of truth for codebase state. Multiplayer reduces to three problems:

### 1. Presence

Who's connected, what element they've selected. Lightweight WebSocket broadcast:

```json
{
  "user": "Alice",
  "selectedElement": "div.hero-banner",
  "sourceFile": "src/Hero.tsx:14"
}
```

Each client renders other users' selections as colored outlines on the iframe. Same pattern Figma uses — a thin real-time presence layer on top of the document state.

### 2. Cursor/Selection Sync

Requires a WebSocket server (or upgrade the existing one). The messages are small — just presence data, not document content.

### 3. Write Conflict Resolution

Mostly free because **writes are serialized through the AI**. Two designers can't simultaneously hand-edit code — they're both requesting AI writes that go through the Surface API. Just need a queue: "Alice's change is being applied, yours is next."

This is dramatically simpler than real-time CRDT-based collaborative editing (which is what makes Google Docs and Figma multiplayer so hard to build).

## Architecture Addition

```
Clients ←→ WebSocket server (on Sprite) ←→ Presence state (in-memory)
                                         ←→ Write queue (serialized AI calls)
```

The Surface API server already sits in the right place. Add a `ws` endpoint, broadcast presence, queue writes.

## The Hard Part: Product, Not Tech

Figma multiplayer works because two designers can work on different frames simultaneously without conflict. In this tool, two designers editing the same page are likely touching overlapping components. AI writes will step on each other. Two options:

- **Component/file-level locking:** "Alice is editing Hero.tsx" — others can view but not edit that file until she's done.
- **Visible queue:** "Your change will apply after Alice's" — both can submit, changes are applied in order.

## Current Status

Not building this yet. The current architecture choices (centralized API server, selection overlay on the iframe) don't block it. When the time comes, add the WebSocket presence layer — no re-architecture needed.