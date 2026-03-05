import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const tokenGroups = [
  {
    name: "Brand",
    tokens: [
      { name: "primary", bg: "bg-primary", fg: "text-primary-foreground" },
      { name: "secondary", bg: "bg-secondary", fg: "text-secondary-foreground" },
      { name: "accent", bg: "bg-accent", fg: "text-accent-foreground" },
    ],
  },
  {
    name: "Semantic",
    tokens: [
      { name: "destructive", bg: "bg-destructive", fg: "text-destructive-foreground" },
      { name: "success", bg: "bg-success", fg: "text-success-foreground" },
      { name: "warning", bg: "bg-warning", fg: "text-warning-foreground" },
    ],
  },
  {
    name: "Surface",
    tokens: [
      { name: "background", bg: "bg-background", fg: "text-foreground" },
      { name: "card", bg: "bg-card", fg: "text-card-foreground" },
      { name: "muted", bg: "bg-muted", fg: "text-muted-foreground" },
    ],
  },
  {
    name: "UI",
    tokens: [
      { name: "border", bg: "bg-border", fg: "text-foreground" },
      { name: "input", bg: "bg-input", fg: "text-foreground" },
      { name: "ring", bg: "bg-ring", fg: "text-primary-foreground" },
    ],
  },
];

export function ColorPalette() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {tokenGroups.map((group) => (
        <Card key={group.name}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {group.tokens.map((token) => (
              <div key={token.name} className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-md border ${token.bg} flex items-center justify-center`}
                >
                  <span className={`text-[10px] font-bold ${token.fg}`}>Aa</span>
                </div>
                <div>
                  <p className="text-sm font-medium">{token.name}</p>
                  <p className="text-xs text-muted-foreground">
                    var(--{token.name})
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
