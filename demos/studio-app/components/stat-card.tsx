import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  progress?: number;
}

export function StatCard({ label, value, change, progress }: StatCardProps) {
  const isPositive = change.startsWith("+");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 justify-start items-start">
        <Badge variant={isPositive ? "default" : "destructive"}>
          {change}
        </Badge>
        {progress !== undefined && <Progress value={progress} />}
      </CardContent>
    </Card>
  );
}
