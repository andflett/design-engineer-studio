import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Feature {
  title: string;
  description: string;
  tag: string;
}

const features: Feature[] = [
  {
    title: "Visual Editing",
    description: "Click any element to inspect and edit styles in real time.",
    tag: "Core",
  },
  {
    title: "Source Mapping",
    description: "Every element carries data-source attributes back to your code.",
    tag: "DX",
  },
  {
    title: "Token System",
    description: "Edit design tokens and see changes propagate instantly.",
    tag: "Tokens",
  },
  {
    title: "Component Isolation",
    description: "Preview components in isolation with all variant combinations.",
    tag: "Preview",
  },
  {
    title: "Multi-Framework",
    description: "Works with Next.js, Vite, and any React setup.",
    tag: "Platform",
  },
  {
    title: "Hot Reload",
    description: "Changes are written to source files with instant HMR feedback.",
    tag: "DX",
  },
];

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => (
        <Card key={f.title} variant="default" elevation="sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{f.title}</CardTitle>
              <Badge variant="secondary" size="sm">
                {f.tag}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>{f.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
