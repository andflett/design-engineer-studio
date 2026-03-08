# Editor Auth Approach

Auth strategy for the browser-based editor, covering local development and OODA Sprite deployment.

## Context

The editor runs on a port on the Sprite, accessible via OODA's Sprite proxy. Locally, auth is not required. On OODA, we need to ensure only the user who owns the Sprite can access the editor.

## Options

### Option 1: Rely on Sprite Proxy Auth (Recommended starting point)

OODA's proxy already gates traffic to Sprite ports. If the proxy only forwards requests from authenticated users who own the Sprite, no additional auth is needed.

**Action item:** Confirm with OODA whether their proxy guarantees that only the Sprite owner can reach the port. Specifically, whether another OODA user could hit the URL if they knew it.

If yes, this is sufficient. Don't build auth we don't need.

### Option 2: Shared Secret Token at Sprite Boot

Generate a random token when the Sprite starts. The editor server validates it on every request.

**Token generation (Sprite startup):**

```bash
export EDITOR_TOKEN=$(openssl rand -hex 32)
```

**HTTP middleware:**

```typescript
app.use((req, res, next) => {
  const token = req.cookies?.editor_token || req.query?.token;
  if (token !== process.env.EDITOR_TOKEN) return res.status(401).send('Unauthorized');
  // Set as httpOnly cookie on first valid access so the token doesn't stay in the URL
  res.cookie('editor_token', token, { httpOnly: true, sameSite: 'strict' });
  next();
});
```

**WebSocket upgrade:**

```typescript
wss.on('connection', (ws, req) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.editor_token !== process.env.EDITOR_TOKEN) return ws.close();
  // proceed
});
```

**Flow:** The OODA client passes the token in the initial URL (`https://sprite-proxy.ooda.dev/...?token=abc123`). After first load, it's stored in an httpOnly cookie and the URL can be shared without leaking the token.

Use this as a belt-and-suspenders layer if the proxy auth alone isn't enough, or if we want defense in depth. Zero external dependencies.

### Option 3: Validate Against OODA's API

If OODA exposes an endpoint to verify "does this session/user own this Sprite", call it server-side:

```typescript
app.use(async (req, res, next) => {
  const session = req.cookies?.ooda_session;
  const valid = await fetch('https://api.ooda.dev/auth/verify', {
    headers: { Authorization: `Bearer ${session}` }
  }).then(r => r.ok);
  if (!valid) return res.status(401).send('Unauthorized');
  next();
});
```

Only worth pursuing if we need fine-grained permissions (e.g., read-only vs read-write for different team members). Adds a runtime dependency on OODA's API availability.

## Recommendation

Start with **Option 1**. If the proxy already authenticates, we're done. If we need an additional layer, add **Option 2** — it's trivial and self-contained. Save **Option 3** for when/if we need per-user permissions (e.g., multiplayer with different roles).