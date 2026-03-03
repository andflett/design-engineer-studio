import { Reveal } from "./reveal.js";

export function Architecture() {
  return (
    <section className="py-24 relative" id="architecture">
      {/* Graph paper grid */}
      <div className="graph-grid absolute inset-0 pointer-events-none" aria-hidden="true" />

      <div className="max-w-[1100px] mx-auto px-6 relative">
        <p className="text-xs font-medium text-ink3 uppercase tracking-widest mb-3 font-mono">
          Architecture
        </p>
        <h2 className="text-[clamp(1.9rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em] leading-tight mb-3">
          Minimal protocol
        </h2>
        <p className="text-base text-ink2 max-w-[480px] leading-relaxed mb-14">
          The editor runs as a separate process. Communication between your app
          and the editor is purely postMessage.
        </p>

        <Reveal>
          <div className="max-w-[700px] mx-auto p-8 max-md:p-5 border border-edge rounded-xl bg-page font-mono text-[13px] text-ink2 relative scanlines overflow-hidden">
            <div className="flex flex-col gap-5 relative">
              {/* Row 1 */}
              <div className="flex items-center gap-4 flex-wrap">
                <Box highlight>Editor UI :4400</Box>
                <Arrow label="postMessage" />
                <Box>Your app (iframe) :3000</Box>
              </div>

              <div className="text-center text-ink3 text-xs pl-8 font-mono">
                {"▼  ▼"}
              </div>

              {/* Row 2 */}
              <div className="flex items-center gap-4 flex-wrap">
                <Box highlight>Write server API</Box>
                <Arrow label="AST edits" />
                <Box>Source files on disk</Box>
              </div>

              <div className="mt-4 pt-4 border-t border-edge text-[11px] text-ink3 leading-relaxed">
                Your app runs untouched at its dev server URL. The editor loads it in an iframe.
                <br />
                <code className="inline-flex items-center px-1.5 py-0.5 bg-raised rounded border border-edge text-[10px] text-ink2 mt-1">
                  data-source="file:line:col"
                </code>{" "}
                attributes injected at compile time.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <span className="text-ink3 text-xs shrink-0 font-mono flex items-center gap-1.5">
      <svg width="12" height="6" viewBox="0 0 12 6" fill="none" className="text-ink3/30">
        <line x1="0" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
      {label}
      <svg width="12" height="6" viewBox="0 0 12 6" fill="none" className="text-ink3/30">
        <line x1="0" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    </span>
  );
}

function Box({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex-1 min-w-[180px] px-4 py-2.5 rounded-lg border text-[13px] ${
        highlight
          ? "border-ink bg-ink text-white font-medium"
          : "border-edge bg-raised text-ink"
      }`}
    >
      {children}
    </div>
  );
}
