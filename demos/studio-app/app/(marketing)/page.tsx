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
    <div className="mx-auto max-w-[72rem] px-[1.5rem] py-[3rem] grid flex">
      {/* Hero */}
      <section className="flex flex-col items-center gap-[1.25rem] text-center text-secondary-foreground hidden">
        <Badge>New Release</Badge>
        <h1 className="text-[2.75rem] font-bold tracking-[-0.04em] leading-[1.1] sm:text-[3.5rem] text-card-foreground text-center">
          Build better interfaces
        </h1>
        <p className="max-w-[40rem] text-[1.125rem] leading-[1.6] text-muted-foreground">
          A demo application showcasing components, tokens, and variants that
          Component Studio can inspect and edit.
        </p>
        <div className="flex gap-3">
          <Button className="rounded-xl" size="lg">Get Started</Button>
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="mt-[4rem] grid gap-[1.5rem] sm:grid-cols-2 lg:grid-cols-3">
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
            <Button data-studio-eid="s4fd3930e" className="gap-2 gap-[19px] gap-2 font-normal" variant="link" size="sm">
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
      <section className="mt-[4rem] rounded-[0.75rem] border bg-card p-[2rem] text-center">
        <h2 className="text-[1.5rem] font-semibold tracking-[-0.02em]">
          Ready to try it?
        </h2>
        <p className="mt-[0.5rem] text-muted-foreground leading-[1.5]">
          Run{" "}
          <code className="rounded-[0.25rem] bg-muted px-[0.375rem] py-[0.125rem] text-[0.875rem] font-mono">
            npx component-studio
          </code>{" "}
          next to your dev server.
        </p>
        <div className="mt-[1.5rem] flex justify-center gap-3">
          <Button>Install Now</Button>
          <Button variant="ghost">View Docs</Button>
        </div>
      </section>

      {/* Badge Variants */}
      <section className="mt-[4rem]">
        <h2 className="mb-[1rem] text-[1.25rem] font-semibold tracking-[-0.01em]">
          Badge Variants
        </h2>
        <div className="flex flex-wrap gap-[0.5rem]">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>

      {/* Button Variants */}
      <section className="mt-[2rem]">
        <h2 className="mb-[1rem] text-[1.25rem] font-semibold tracking-[-0.01em]">
          Button Variants
        </h2>
        <div className="flex flex-wrap gap-[0.75rem]">
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
