import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <header data-slot="hero" className="flex flex-col gap-3">
      <Badge variant="secondary" className="w-fit">Beta</Badge>
      <h1 className="text-3xl font-bold tracking-tight">Component Studio</h1>
      <p className="text-muted-foreground">
        Visual editing that writes back to your source files.
      </p>
      <nav className="flex gap-2">
        <Button>Get Started</Button>
        <Button variant="outline">Docs</Button>
      </nav>
    </header>
  );
}
