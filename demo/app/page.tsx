import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 text-center">
        <Badge>New Release</Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Build better interfaces
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A demo application showcasing components, tokens, and variants that
          Component Studio can inspect and edit.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="lg">Get Started</Button>
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Tokens</CardTitle>
            <CardDescription>
              Edit colors, spacing, and radius at the system level.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Changes propagate everywhere instantly via CSS custom properties
              and HMR.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="link" size="sm">
              Explore
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
            <CardDescription>
              Modify component definitions across all instances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Edit Tailwind classes within CVA variant definitions using a
              structured property panel.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm">
              Explore
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instances</CardTitle>
            <CardDescription>
              Tweak individual component usages on a page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Change variant props, toggle boolean props, or add className
              overrides to specific instances.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm">
              Explore
            </Button>
          </CardFooter>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="mt-16 rounded-lg border bg-card p-8 text-center">
        <h2 className="text-2xl font-semibold">Ready to try it?</h2>
        <p className="mt-2 text-muted-foreground">
          Run <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">npx component-studio</code> next
          to your dev server.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button>Install Now</Button>
          <Button variant="ghost">View Docs</Button>
        </div>
      </section>

      {/* Badge Variants */}
      <section className="mt-16">
        <h2 className="mb-4 text-xl font-semibold">Badge Variants</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>

      {/* Button Variants */}
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Button Variants</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>
    </div>
  );
}
