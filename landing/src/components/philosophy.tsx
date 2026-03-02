import { BracesContent } from "pixelarticons/react/BracesContent";
import { Target } from "pixelarticons/react/Target";
import { Grid3x3 } from "pixelarticons/react/Grid3x3";
import { Reveal } from "./reveal.js";

const cards = [
  {
    icon: <BracesContent width={20} height={20} />,
    title: "Your code, not a canvas",
    description:
      "No import/export cycle. Surface loads your running app in an iframe and edits source files directly. The app you see is the app you ship.",
  },
  {
    icon: <Target width={20} height={20} />,
    title: "Deterministic, not generative",
    description:
      "You click a property, you change a value, the exact edit is written to your file. No AI guessing what you meant. Precision by default.",
  },
  {
    icon: <Grid3x3 width={20} height={20} />,
    title: "Design system thinking",
    description:
      "Tokens, components, instances. Surface maps your codebase structure and encourages systematic changes over freeform pixel pushing.",
  },
];

export function Philosophy() {
  return (
    <>
      <div className="dither-band" />
      <section className="py-24 bg-raised checker-dither">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-ink3 uppercase tracking-widest mb-3 font-mono">
              Philosophy
            </p>
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-normal tracking-[-0.025em] leading-[1.1]" style={{ fontFamily: "'Jersey 25', sans-serif" }}>
              Your code, your rules
            </h2>
          </div>

          <div className="grid grid-cols-3 max-md:grid-cols-1 gap-px bg-edge-subtle rounded-xl overflow-hidden border border-edge-subtle">
          {cards.map((card, i) => (
            <Reveal key={card.title} delay={i * 0.08}>
              <div className="bg-page p-8 h-full">
                <div className="text-ink3 mb-4">{card.icon}</div>
                <h3 className="text-[15px] font-semibold mb-2 tracking-tight">
                  {card.title}
                </h3>
                <p className="text-[13px] text-ink2 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
          <Reveal delay={0.25}>
            <p className="mt-8 text-center text-[13px] text-ink3">
              Read the full story and follow along with development on{" "}
              <a
                href="https://www.flett.cc/projects/design-engineer-studio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink2 underline underline-offset-2 hover:text-ink transition-colors font-mono"
              >
                flett.cc
              </a>
            </p>
          </Reveal>
        </div>
      </section>
      <div className="dither-band" />
    </>
  );
}
