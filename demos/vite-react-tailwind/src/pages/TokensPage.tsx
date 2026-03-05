import { ColorPalette } from "@/components/color-palette";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const typographyScale = [
  { name: "text-xs", class: "text-xs", size: "0.75rem" },
  { name: "text-sm", class: "text-sm", size: "0.875rem" },
  { name: "text-base", class: "text-base", size: "1rem" },
  { name: "text-lg", class: "text-lg", size: "1.125rem" },
  { name: "text-xl", class: "text-xl", size: "1.25rem" },
  { name: "text-2xl", class: "text-2xl", size: "1.5rem" },
  { name: "text-3xl", class: "text-3xl", size: "1.875rem" },
  { name: "text-4xl", class: "text-4xl", size: "2.25rem" },
];

const spacingScale = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
const radiusScale = ["rounded-none", "rounded-sm", "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full"];
const shadowScale = ["shadow-none", "shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl"];

export function TokensPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Color Tokens</h2>
        <ColorPalette />
      </section>

      <Separator />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Typography Scale</h2>
        <Card>
          <CardContent className="p-6 space-y-3">
            {typographyScale.map((t) => (
              <div key={t.name} className="flex items-baseline gap-4">
                <span className="w-20 text-xs text-muted-foreground font-mono shrink-0">
                  {t.size}
                </span>
                <span className={`${t.class} font-medium`}>
                  {t.name} — The quick brown fox
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Spacing Scale</h2>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {spacingScale.map((s) => (
                <div key={s} className="flex items-center gap-4">
                  <span className="w-12 text-xs text-muted-foreground font-mono shrink-0">
                    {s * 4}px
                  </span>
                  <div
                    className="bg-primary rounded-sm h-4"
                    style={{ width: `${s * 16}px` }}
                  />
                  <span className="text-xs text-muted-foreground">
                    space-{s}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Border Radius</h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4">
              {radiusScale.map((r) => (
                <div key={r} className="flex flex-col items-center gap-2">
                  <div
                    className={`h-16 w-16 bg-primary ${r}`}
                  />
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {r.replace("rounded-", "").replace("rounded", "default")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Shadows</h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-6">
              {shadowScale.map((s) => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <div
                    className={`h-16 w-16 rounded-lg bg-card border ${s}`}
                  />
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {s.replace("shadow-", "").replace("shadow", "default")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
