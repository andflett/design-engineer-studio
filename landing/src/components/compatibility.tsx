import { Reveal } from "./reveal.js";

const stylingRows = [
  { name: "Tailwind CSS", versions: "v3 / v4", status: "stable" },
  { name: "CSS Variables", versions: "Custom properties", status: "stable" },
  { name: "Plain CSS", versions: "Stylesheets", status: "stable" },
  { name: "CSS Modules", versions: ".module.css", status: "stable" },
  { name: "Sass / SCSS", versions: "$variables", status: "planned" },
];

const frameworkRows = [
  { name: "Next.js", versions: "App + Pages router", status: "stable" },
  { name: "Vite + React", versions: "via plugin", status: "stable" },
  { name: "Astro", versions: "Islands", status: "stable" },
  { name: "Remix", versions: "Vite-based", status: "stable" },
  { name: "Vue / Nuxt", versions: "SFC templates", status: "next" },
];

function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px]">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "stable"
            ? "bg-green-400"
            : status === "next"
              ? "bg-amber-400"
              : "bg-ink3/40"
        }`}
      />
      {status}
    </span>
  );
}

export function Compatibility() {
  return (
    <section className="py-24 border-t border-edge-subtle relative" id="compatibility">
      {/* Dot grid background */}
      <div className="dot-grid absolute inset-0 pointer-events-none" aria-hidden="true" />

      <div className="max-w-[1100px] mx-auto px-6 relative">
        <p className="text-xs font-medium text-ink3 uppercase tracking-widest mb-3 font-mono">
          Compatibility
        </p>
        <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-normal tracking-[-0.025em] leading-[1.1] mb-3" style={{ fontFamily: "'Jersey 25', sans-serif" }}>
          Any styling system. Any framework.
        </h2>
        <p className="text-base text-ink2 max-w-[520px] leading-relaxed mb-14">
          Most visual editors only work with Tailwind on Next.js. Surface
          detects your styling approach and writes changes in your project's
          native format.
        </p>

        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
          <Reveal>
            <div className="rounded-xl border border-edge overflow-hidden bg-page">
              <div className="px-5 py-3 border-b border-edge bg-raised">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-ink3 font-mono">
                  Styling systems
                </span>
              </div>
              {stylingRows.map((row, i) => (
                <div
                  key={row.name}
                  className={`flex items-center justify-between px-5 py-2.5 ${
                    i < stylingRows.length - 1 ? "border-b border-edge-subtle" : ""
                  }`}
                >
                  <div>
                    <span className="text-[13px] font-medium text-ink">{row.name}</span>
                    <span className="text-[11px] text-ink3 ml-2">{row.versions}</span>
                  </div>
                  <StatusDot status={row.status} />
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-xl border border-edge overflow-hidden bg-page">
              <div className="px-5 py-3 border-b border-edge bg-raised">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-ink3 font-mono">
                  Frameworks
                </span>
              </div>
              {frameworkRows.map((row, i) => (
                <div
                  key={row.name}
                  className={`flex items-center justify-between px-5 py-2.5 ${
                    i < frameworkRows.length - 1 ? "border-b border-edge-subtle" : ""
                  }`}
                >
                  <div>
                    <span className="text-[13px] font-medium text-ink">{row.name}</span>
                    <span className="text-[11px] text-ink3 ml-2">{row.versions}</span>
                  </div>
                  <StatusDot status={row.status} />
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="mt-8 flex items-center gap-6 text-[11px] text-ink3 font-mono">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> stable</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> next</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-ink3/40" /> planned</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
