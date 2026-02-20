import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const posts = [
  {
    slug: "getting-started",
    title: "Getting Started with Component Studio",
    excerpt:
      "Learn how to set up Component Studio and start visually editing your design tokens, components, and instances.",
    date: "2025-01-15",
    tag: "Tutorial",
  },
  {
    slug: "design-tokens",
    title: "Understanding Design Tokens",
    excerpt:
      "A deep dive into how design tokens work with CSS custom properties and Tailwind CSS v4.",
    date: "2025-01-10",
    tag: "Concepts",
  },
  {
    slug: "cva-patterns",
    title: "CVA Variant Patterns",
    excerpt:
      "Best practices for structuring your component variants using class-variance-authority.",
    date: "2025-01-05",
    tag: "Patterns",
  },
];

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-[48rem] px-[1.5rem] py-[2.5rem]">
      <h1 className="text-[2rem] font-bold tracking-[-0.03em] leading-[1.2]">
        Blog
      </h1>
      <p className="mt-[0.5rem] text-[1rem] text-muted-foreground leading-[1.6]">
        Articles about visual editing, design systems, and component
        architecture.
      </p>

      <div className="mt-[2rem] flex flex-col gap-[1.25rem]">
        {posts.map((post) => (
          <a key={post.slug} href={`/blog/${post.slug}`}>
            <Card className="transition-colors hover:border-foreground/20">
              <CardHeader>
                <div className="flex items-center gap-[0.5rem]">
                  <Badge variant="secondary">{post.tag}</Badge>
                  <span className="text-[0.75rem] text-muted-foreground">
                    {post.date}
                  </span>
                </div>
                <CardTitle className="text-[1.25rem] leading-[1.3]">
                  {post.title}
                </CardTitle>
                <CardDescription className="leading-[1.5]">
                  {post.excerpt}
                </CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
