import { cn } from "~/lib/utils";

interface CardProps {
  title: string;
  value: string;
  description: string;
  className?: string;
}

export function Card({ title, value, description, className }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-lg border bg-background p-6 shadow-sm",
        className
      )}
    >
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
