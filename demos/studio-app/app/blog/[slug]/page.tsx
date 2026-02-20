import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const posts: Record<
  string,
  { title: string; tag: string; date: string; content: string[] }
> = {
  "getting-started": {
    title: "Getting Started with Component Studio",
    tag: "Tutorial",
    date: "2025-01-15",
    content: [
      "Component Studio is a visual editing tool that runs alongside your development server. It proxies your app inside an iframe and lets you inspect and edit design tokens, component variants, and individual element styles — writing changes back to your source files in real time.",
      "To get started, simply run npx designtools-studio next to your dev server. The tool will detect your framework, scan your project for tokens and components, and open a browser window with your app loaded inside the editing interface.",
      "From there, click any element to select it. The editor panel on the right shows three modes: Token (for editing design tokens), Component (for editing CVA variant definitions), and Instance (for tweaking individual elements on the page).",
    ],
  },
  "design-tokens": {
    title: "Understanding Design Tokens",
    tag: "Concepts",
    date: "2025-01-10",
    content: [
      "Design tokens are the atomic values in your design system — colors, spacing, typography scales, radii, and shadows. In Tailwind CSS v4, these map directly to CSS custom properties defined in your @theme layer.",
      "Component Studio scans your CSS files to discover all token definitions. When you edit a token value, the change is written back to the source CSS file and picked up by HMR, propagating instantly across every component that references it.",
      "This approach gives you the best of both worlds: the type safety and IDE support of Tailwind utility classes, combined with the flexibility of visual editing for design exploration.",
    ],
  },
  "cva-patterns": {
    title: "CVA Variant Patterns",
    tag: "Patterns",
    date: "2025-01-05",
    content: [
      "Class Variance Authority (CVA) is a library for building type-safe component variants. It lets you define base classes and named variant options that map to specific Tailwind class combinations.",
      "Component Studio understands CVA definitions natively. When you scan a project, it parses the cva() calls to extract variant names, options, and the classes associated with each. This powers the Component editing mode in the UI.",
      "For best results, keep your CVA definitions simple and flat. Use data-slot attributes on your rendered elements so the inject script can identify components by their semantic role rather than relying on className matching alone.",
    ],
  },
};

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = posts[slug];

  if (!post) {
    return (
      <div className="mx-auto max-w-[48rem] px-[1.5rem] py-[2.5rem] text-center">
        <h1 className="text-[1.5rem] font-semibold">Post not found</h1>
        <p className="mt-[0.5rem] text-muted-foreground">
          The article you're looking for doesn't exist.
        </p>
        <a href="/blog">
          <Button variant="outline" className="mt-[1rem]">
            Back to Blog
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[48rem] px-[1.5rem] py-[2.5rem]">
      <a href="/blog">
        <Button variant="ghost" size="sm" className="mb-[1.5rem]">
          ← Back to Blog
        </Button>
      </a>

      <div className="flex items-center gap-[0.5rem] mb-[1rem]">
        <Badge variant="secondary">{post.tag}</Badge>
        <span className="text-[0.75rem] text-muted-foreground">
          {post.date}
        </span>
      </div>

      <h1 className="text-[2rem] font-bold tracking-[-0.03em] leading-[1.2]">
        {post.title}
      </h1>

      <div className="mt-[2rem] flex flex-col gap-[1.25rem]">
        {post.content.map((paragraph, i) => (
          <p
            key={i}
            className="text-[1rem] leading-[1.7] text-muted-foreground"
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-[3rem] border-t pt-[2rem] flex justify-between">
        <Button variant="outline">Previous Article</Button>
        <Button variant="outline">Next Article</Button>
      </div>
    </div>
  );
}
