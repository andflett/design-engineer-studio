import { motion } from "motion/react";
import { DitherGradient } from "./dither-gradient.js";
import { DitherGlow } from "./dither-glow.js";
import { LogoBar } from "./logo-bar.js";
import { WaitlistForm } from "./waitlist.js";

export function Hero() {
  return (
    <section className="relative pt-0 text-center overflow-hidden">
      {/* Dark header band that dissolves via Bayer dither */}
      <div className="bg-ink">
        <div className="pt-28 pb-14 max-w-[1100px] mx-auto px-6 relative">
          {/* Dithered glow — static, not inside motion */}
          <div className="relative inline-flex justify-center mb-6">
            <DitherGlow
              width={550}
              height={125}
              pixelSize={3}
              color="rgba(255,255,255,0.15)"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            />
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 text-xs font-medium text-white/70  font-mono relative rounded-full"
            >
              <span className="animate-pulse w-1.5 h-1.5 bg-green-400 rounded-full" />
              v0.1 — @designtools/surface
            </motion.span>
          </div>

          <motion.h1
            className="text-[clamp(2.75rem,6.5vw,4.5rem)] font-normal leading-[1.0] tracking-[-0.025em] text-white mb-5"
            style={{ fontFamily: "'Jersey 25', sans-serif" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            Visual editing for
            <br />
            production frontends
          </motion.h1>

          <motion.p
            className="text-lg text-white/80 max-w-[500px] mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            A multi-framework design tool that understands your design system, sits on top of your production code,
            and writes changes back to source.
          </motion.p>

          <LogoBar />
        </div>
      </div>

      {/* Bayer dither dissolve edge */}
      <DitherGradient
        direction="down"
        height={160}
        pixelSize={4}
        color="#09090b"
      />
    </section>
  );
}
