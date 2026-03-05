/**
 * Demo app for plain CSS + CSS variables styling.
 * Tests Surface's Phase 1a (plain CSS write adapter) and 1b (CSS variables adapter).
 *
 * Every element uses plain CSS classes defined in styles.css.
 * Tokens (CSS custom properties) are used for colors, spacing, radii, and typography.
 */
import { StatusCard } from "./StatusCard";

export default function App() {
  return (
    <div className="page">
      <header className="header">
        <h1 className="header-title">Surface CSS Demo</h1>
        <p className="header-subtitle">
          Plain CSS classes + CSS custom properties — no Tailwind, no modules
        </p>
      </header>

      {/* Stats row — tests spacing, typography, color tokens */}
      <div className="stats-row">
        <div className="stat">
          <div className="stat-value">1,284</div>
          <div className="stat-label">Active users</div>
        </div>
        <div className="stat">
          <div className="stat-value">98.5%</div>
          <div className="stat-label">Uptime</div>
        </div>
        <div className="stat">
          <div className="stat-value">3.2s</div>
          <div className="stat-label">Avg. response</div>
        </div>
      </div>

      {/* Card grid — tests border-radius, box-shadow, padding, hover states */}
      <h2 className="section-title">Features</h2>
      <div className="card-grid">
        <div className="card">
          <div className="card-icon">⚡</div>
          <h3 className="card-title">Fast Builds</h3>
          <p className="card-description">
            Lightning-fast build times with incremental compilation and smart caching.
          </p>
        </div>
        <div className="card">
          <div className="card-icon">🎨</div>
          <h3 className="card-title">Design Tokens</h3>
          <p className="card-description">
            CSS custom properties for consistent theming across your entire app.
          </p>
        </div>
        <div className="card">
          <div className="card-icon">🔧</div>
          <h3 className="card-title">Easy Setup</h3>
          <p className="card-description">
            No configuration needed. Just write CSS and it works everywhere.
          </p>
        </div>
      </div>

      {/* Token showcase — tests color swatch editing */}
      <h2 className="section-title">Color Tokens</h2>
      <div className="token-grid">
        <div>
          <div className="color-swatch" style={{ background: "var(--color-primary)" }} />
          <div className="color-swatch-label">--color-primary</div>
        </div>
        <div>
          <div className="color-swatch" style={{ background: "var(--color-secondary)" }} />
          <div className="color-swatch-label">--color-secondary</div>
        </div>
        <div>
          <div className="color-swatch" style={{ background: "var(--color-accent)" }} />
          <div className="color-swatch-label">--color-accent</div>
        </div>
        <div>
          <div className="color-swatch" style={{ background: "var(--color-border)" }} />
          <div className="color-swatch-label">--color-border</div>
        </div>
      </div>

      {/* CSS Modules — tests CSS module write path */}
      <h2 className="section-title">CSS Modules</h2>
      <div className="card-grid">
        <StatusCard title="Module Card" description="This card uses CSS Modules for scoped styles." />
      </div>

      {/* Form controls — tests input styling, button variants */}
      <h2 className="section-title">Controls</h2>
      <div className="input-group">
        <label className="input-label">Email address</label>
        <input className="input" type="email" placeholder="you@example.com" />
      </div>
      <div className="input-group">
        <label className="input-label">Project name</label>
        <input className="input" type="text" placeholder="My Project" />
      </div>
      <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-2xl)" }}>
        <button className="button button-primary">Save changes</button>
        <button className="button button-secondary">Cancel</button>
        <span className="badge">New</span>
        <span className="badge badge-secondary">Draft</span>
      </div>

      <footer className="footer">
        Surface CSS Demo — testing plain CSS + CSS variables write adapters
      </footer>
    </div>
  );
}
