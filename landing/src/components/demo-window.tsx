import { Reveal } from "./reveal.js";

export function DemoWindow() {
  return (
    <section className="pb-16 pt-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <Reveal>
          <div className="max-w-[960px] mx-auto rounded-md border border-edge overflow-hidden bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_-8px_rgba(0,0,0,0.08)]">
            <img
              src="/screen.png"
              alt="Surface editor interface"
              className="w-full block"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
