import { motion } from "motion/react";
import { DitherGlow } from "./dither-glow.js";
import { Reveal } from "./reveal.js";

const links = [
  {
    label: "npm",
    href: "https://www.npmjs.com/package/@designtools/surface",
    mono: "npm i @designtools/surface",
  },
  {
    label: "GitHub",
    href: "https://github.com/andflett/designtools",
    mono: "github.com/andflett/designtools",
  },
];

export function Stack() {
  return (
    <section className="relative py-24 overflow-hidden border-t border-edge-subtle">
      <div className="max-w-[1100px] mx-auto px-6 text-center relative">
        <Reveal>
          <div className="relative inline-flex justify-center mb-5">
            <DitherGlow
              width={400}
              height={100}
              pixelSize={3}
              color="rgba(255,255,255,0.08)"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            />
            <span className="inline-flex items-center uppercase gap-2.5 px-4 py-1.5 text-xs font-medium text-ink3 font-mono relative rounded-full">
              <span className="animate-pulse w-1.5 h-1.5 bg-amber-400 rounded-full" />
              Active development
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <h2
            className="text-[clamp(1.9rem,4vw,3rem)] font-normal leading-[1.1] tracking-[-0.025em] mb-5"
            style={{ fontFamily: "'Jersey 25', sans-serif" }}
          >
            Feeling adventurous?
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-base text-ink2 max-w-[480px] mx-auto leading-relaxed mb-10">
            We're not ready yet. Things will break, APIs will change, and
            your colleagues might
            judge you. But if you like living on the edge, the source is
            open and the package is published.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {links.map((link) => (
              <motion.a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-5 py-3 rounded-lg border border-edge-subtle bg-raised/50 hover:bg-raised hover:border-ink3/20 transition-all duration-200 w-full sm:w-auto"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
              >
                <span className="text-xs font-semibold uppercase tracking-widest text-ink3 shrink-0">
                  {link.label}
                </span>
                <span className="font-mono text-[11px] text-ink2 group-hover:text-ink transition-colors">
                  {link.mono}
                </span>
              </motion.a>
            ))}
          </div>
        </Reveal>

    
      </div>
    </section>
  );
}
