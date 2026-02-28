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
        <Button className="flex text-[rgb(215_215_215)] text-background">Get Started</Button>
        <Button variant="outline" className="opacity-45 opacity-55 opacity-0 shadow-lg bg-[image:var(--gradient-1)] opacity-75">Docs</Button>
      </nav>
    </header>
  );
}
