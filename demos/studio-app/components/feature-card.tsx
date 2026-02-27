import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FeatureCardProps {
  title: string;
  description: string;
  detail: string;
  badge: string;
}

export function FeatureCard({ title, description, detail, badge }: FeatureCardProps) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="outline" className="w-fit">
          {badge}
        </Badge>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
