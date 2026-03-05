export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div data-slot="card" className="rounded-lg bg-card text-card-foreground border border-border p-lg shadow-sm">
      <h3 className="text-lg font-semibold mb-sm">{title}</h3>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
