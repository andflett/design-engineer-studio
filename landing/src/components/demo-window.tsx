"use client";

import { useRef, useState } from "react";
import { Reveal } from "./reveal.js";

export function DemoWindow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function handlePlay() {
    const video = videoRef.current;
    if (!video) return;
    video.play();
    setPlaying(true);
  }

  return (
    <section className="pb-16 pt-16">
      <div className="max-w-[1100px] mx-auto px-6">
        <Reveal>
          <div className="max-w-[960px] mx-auto rounded-md border border-edge overflow-hidden bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_-8px_rgba(0,0,0,0.08)]">
            <div
              className="relative cursor-pointer"
              onClick={!playing ? handlePlay : undefined}
            >
              <video
                ref={videoRef}
                src="/designtools-surface.mp4"
                poster="/designtools-surface.png"
                controls={playing}
                className="w-full block"
                onEnded={() => setPlaying(false)}
              />
              {!playing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="scale-60 md:scale-100 w-24 h-24 rounded-full bg-white flex items-center justify-center transition-transform hover:scale-110">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="97.533 44.972 12.805 14.02" width="32" height="32" className="relative left-[2px]">
  <rect x="-108.1" y="-50.992" width="2.857" height="2" transform="matrix(-1, 0, 0, -1, 0, 0)" fill="black" />
  <rect x="-108.1" y="-54.992" width="2.857" height="2" transform="matrix(-1, 0, 0, -1, 0, 0)" fill="black" />
  <rect x="-105.24" y="-56.992" width="2.857" height="2" transform="matrix(-1, 0, 0, -1, 0, 0)" fill="black" />
  <rect x="-105.24" y="-48.992" width="2.857" height="2" transform="matrix(-1, 0, 0, -1, 0, 0)" fill="black" />
  <rect x="-102.38" y="-46.992" width="2.857" height="2" transform="matrix(-1, 0, 0, -1, 0, 0)" fill="black" />
  <rect x="-100.39" y="-58.974" width="2.857" height="14.002" transform="matrix(-1, 0, 0, -1, 0, 0)" fill="black" />
  <rect width="2.234" height="2" transform="matrix(1, 0, 0, -1, 0, 0)" fill="black" x="108.104" y="-52.992" />
  <rect x="99.532" y="56.992" width="2.857" height="2" fill="black" />
</svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
