import { useSyncExternalStore } from "react";
import { Nav } from "./components/nav.js";
import { Hero } from "./components/hero.js";
import { DemoWindow } from "./components/demo-window.js";
import { Philosophy } from "./components/philosophy.js";
import { ThreeTiers } from "./components/three-tiers.js";
import { Differentiators } from "./components/differentiators.js";
import { Compatibility } from "./components/compatibility.js";
import { Stack } from "./components/stack.js";
import { Waitlist } from "./components/waitlist.js";
import { Footer } from "./components/footer.js";
import { Privacy } from "./components/privacy.js";

function useHash() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
  );
}

export function App() {
  const hash = useHash();

  if (hash === "#privacy") {
    return (
      <>
        <Nav />
        <Privacy />
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <Hero />
      <DemoWindow />
      <Philosophy />
      <ThreeTiers />
      <Compatibility />
      <Differentiators />
      <Stack />
      <Waitlist />
      <Footer />
    </>
  );
}
