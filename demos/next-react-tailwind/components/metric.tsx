import { Progress } from "@/components/ui/progress";

export function Metric({
  label,
  value,
  unit,
  progress,
  variant = "default",
}: {
  label: string;
  value: string | number;
  unit?: string;
  progress?: number;
  variant?: "default" | "gradient";
}) {
  return (
    <dl data-slot="metric" className="space-y-1">
      <dt data-slot="metric-label" className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </dt>
      <dd data-slot="metric-value" className="text-3xl font-bold tracking-tight">
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-0.5">{unit}</span>}
      </dd>
      {progress !== undefined && <Progress value={progress} variant={variant} />}
    </dl>
  );
}
