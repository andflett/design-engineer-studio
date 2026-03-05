import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <h1 className="text-sm font-bold tracking-tight">
            designtools / remix
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-extrabold pl-24 p-24 pr-3.5 pb-3.5 text-center uppercase text-[rgb(147_43_43)] bg-[rgb(27_160_32_/_0)] bg-[rgb(27_161_32)] rounded-xl border-[6px] border-[rgb(49_43_148)] opacity-60 flex flex-col flex-wrap items-start justify-start">Dashboard</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card title="Users" value="1,234" description="Total registered" />
            <Card title="Revenue" value="$12.4k" description="This month" />
            <Card title="Orders" value="342" description="Pending fulfillment" />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-bold">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold">Content</h2>
          <div className="rounded-lg border bg-muted/50 p-6">
            <p className="text-sm text-muted-foreground">
              This is a simple React Router v7 (Remix) demo app for testing
              designtools Surface integration. It uses Tailwind CSS v4 with
              theme tokens and shared UI components.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
