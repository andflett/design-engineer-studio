const metrics = [
  { label: "Design Tokens", value: "24", sub: "6 shadow tokens" },
  { label: "Components", value: "18", sub: "All using elevation" },
  { label: "Surfaces", value: "4", sub: "Depth levels" },
  { label: "Updated", value: "3", sub: "Tokens changed today" },
];

const tokens = [
  { name: "--shadow-xs", usage: "Inputs, toggles", layers: "1 layer", status: "Active" },
  { name: "--shadow-sm", usage: "Cards, panels", layers: "2 layers", status: "Active" },
  { name: "--shadow-md", usage: "Dropdowns, tooltips", layers: "2 layers", status: "Active" },
  { name: "--shadow-lg", usage: "Modals, drawers", layers: "2 layers", status: "Active" },
  { name: "--shadow-xl", usage: "Floating actions", layers: "2 layers", status: "Active" },
];

const activity = [
  "Updated shadow-sm to use 3-layer crisp approach",
  "Adjusted shadow-lg blur radius for softer edges",
  "Added shadow-inner token for input fields",
  "Changed shadow color from black to OKLCh tinted hue",
  "Exported @theme block to design-tokens.json",
];

export default function ShadowTokensPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Shadow Tokens</h1>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-accent text-accent-fg hover:opacity-85 cursor-pointer">
          Export Tokens
        </button>
      </div>

      {/* Stat cards — xs shadow */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-card rounded-lg shadow-xs p-5"
          >
            <div className="text-[13px] text-text-muted mb-1">{m.label}</div>
            <div className="text-[28px] font-bold leading-tight">{m.value}</div>
            <div className="text-[13px] text-text-muted">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-4 mb-6">
        {/* Token table — sm shadow */}
        <div className="bg-card rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <span className="text-sm font-semibold">Token Scale</span>
            <button className="px-3 py-1 text-[13px] text-text-muted border border-border rounded-md hover:opacity-85 cursor-pointer">
              Edit All
            </button>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left px-5 py-2.5 font-medium text-text-muted bg-surface">Token</th>
                <th className="text-left px-5 py-2.5 font-medium text-text-muted bg-surface">Usage</th>
                <th className="text-left px-5 py-2.5 font-medium text-text-muted bg-surface">Layers</th>
                <th className="text-left px-5 py-2.5 font-medium text-text-muted bg-surface">Status</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.name}>
                  <td className="px-5 py-2.5 border-t border-border font-semibold font-mono text-[13px]">{t.name}</td>
                  <td className="px-5 py-2.5 border-t border-border">{t.usage}</td>
                  <td className="px-5 py-2.5 border-t border-border text-[13px] text-text-muted">{t.layers}</td>
                  <td className="px-5 py-2.5 border-t border-border">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green/10 text-green">
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Activity — md shadow */}
          <div className="bg-card rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="text-sm font-semibold">Recent Edits</span>
            </div>
            <div>
              {activity.map((item, i) => (
                <div
                  key={i}
                  className={`px-5 py-2.5 text-[13px] ${i < activity.length - 1 ? "border-b border-border" : ""}`}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Presets panel — lg shadow */}
          <div className="bg-card rounded-lg shadow-lg p-5 text-center">
            <div className="text-sm font-semibold mb-2">Apply Preset</div>
            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-1 text-[13px] text-text-muted border border-border rounded-md hover:opacity-85 cursor-pointer">Crisp</button>
              <button className="px-3 py-1 text-[13px] text-text-muted border border-border rounded-md hover:opacity-85 cursor-pointer">Soft</button>
              <button className="px-3 py-1 text-[13px] text-text-muted border border-border rounded-md hover:opacity-85 cursor-pointer">Chunky</button>
              <button className="px-3 py-1 text-[13px] text-text-muted border border-border rounded-md hover:opacity-85 cursor-pointer">Material</button>
            </div>
          </div>

          {/* Elevation preview — xl shadow + inner shadow */}
          <div className="bg-card rounded-lg shadow-xl p-5">
            <div className="text-sm font-semibold mb-3">Depth Coverage</div>
            <div className="h-2 rounded-full shadow-inner bg-surface overflow-hidden">
              <div className="w-[83%] h-full bg-accent rounded-full" />
            </div>
            <div className="text-[13px] text-text-muted mt-2">
              5 of 6 shadow tokens in use
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
