import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  tag,
  description,
  children,
}: {
  title: string;
  tag?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header data-slot="page-header" className="flex items-start justify-between">
      <hgroup>
        <h1 data-slot="page-title" className="text-xl font-bold tracking-tight border-[1px]">
          {title}
          {tag && <Badge variant="secondary" size="sm" className="ml-2 align-middle">{tag}</Badge>}
        </h1>
        {description && (
          <p data-slot="page-description" className="text-base text-muted-foreground mt-1">{description}</p>
        )}
      </hgroup>
      {children}
    </header>
  );
}
