import { motion } from "motion/react";
import { DitherGradient } from "./dither-gradient.js";
import { DitherGlow } from "./dither-glow.js";
import { WaitlistForm } from "./waitlist.js";

export function Hero() {
  return (
    <section className="relative pt-0 text-center overflow-hidden">
      {/* Dark header band that dissolves via Bayer dither */}
      <div className="bg-ink">
        <div className="pt-28 pb-14 max-w-[1100px] mx-auto px-6 relative">
          {/* Dithered glow — static, not inside motion */}
          <div className="relative inline-flex justify-center mb-6">
            <DitherGlow width={360} height={100} pixelSize={4} color="rgba(255,255,255,0.15)" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 text-xs font-medium text-white/70  font-mono relative rounded-full"
            >
              <span className="animate-pulse w-1.5 h-1.5 bg-green-400 rounded-full" />
              v0.1 — open source
            </motion.span>
          </div>

          <motion.h1
            className="text-[clamp(2.75rem,6.5vw,4.5rem)] font-semibold leading-[1.05] tracking-[0.025em] text-white mb-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            Visual editing for
            <br />
            production code
          </motion.h1>

          <motion.p
            className="text-lg text-white/80 max-w-[460px] mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            A visual design layer that understands your design system, sits on
            top of your production code, and writes changes back to source
          </motion.p>
        </div>
      </div>

      {/* Bayer dither dissolve edge */}
      <DitherGradient
        direction="down"
        height={160}
        pixelSize={4}
        color="#09090b"
      />

      <div className="max-w-[1100px] mx-auto px-6 relative pt-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
        >
          <WaitlistForm />
        </motion.div>
      </div>
    </section>
  );
}
