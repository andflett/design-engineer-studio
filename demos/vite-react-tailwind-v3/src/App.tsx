import { Card } from "./components/Card";
import { Button } from "./components/Button";

export default function App() {
  return (
    <div className="min-h-screen p-xl">
      <div className="mx-auto max-w-3xl">
        <header className="mb-2xl">
          <h1 className="text-3xl font-bold tracking-tight mb-xs">Tailwind v3 Theme Demo</h1>
          <p className="text-lg text-muted-foreground">Custom spacing, typography, and radius scales</p>
        </header>

        <section className="mb-2xl">
          <h2 className="text-2xl font-semibold mb-md">Cards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-lg">
            <Card title="Spacing">Uses custom xs/sm/md/lg/xl scale instead of numeric.</Card>
            <Card title="Typography">Custom font sizes and weights from the theme config.</Card>
            <Card title="Radius">Curated border-radius scale with sm/md/lg/xl/full.</Card>
          </div>
        </section>

        <section className="mb-2xl">
          <h2 className="text-2xl font-semibold mb-md">Controls</h2>
          <div className="flex gap-sm">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </section>

        <footer className="text-xs text-muted-foreground pt-xl border-t border-border">
          Tailwind v3 Theme Demo — custom scales resolved by Surface
        </footer>
      </div>
    </div>
  );
}
