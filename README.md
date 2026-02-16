# Design Engineer Studio

Visual editing CLI for design tokens, component variants, and Tailwind classes — writes changes back to source files.

[Read the write-up](https://www.flett.cc/projects/design-engineer-studio)

## Try the demo

The included demo is a Next.js app with design tokens, CVA component variants, and multiple routes — everything you need to see the studio in action.

### Prerequisites

- Node.js 18+

### Setup

```bash
git clone https://github.com/andflett/design-engineer-studio.git
cd design-engineer-studio

# Install dependencies for both the studio and demo
npm install
cd demo && npm install && cd ..

# Build the studio CLI
npm run build
```

### Run

You need two terminals:

**Terminal 1** — start the demo app:

```bash
npm run demo
```

**Terminal 2** — start the studio:

```bash
npx design-engineer-studio
```

The studio opens at [http://localhost:4400](http://localhost:4400) with the demo app proxied inside it.

## What you can edit

- **Tokens** — CSS custom properties (colors, spacing, radius) at the system level
- **Components** — CVA variant definitions (button sizes, badge styles, etc.)
- **Instances** — individual component classNames in your source code

All changes are written directly back to your source files.

## Use with your own project

```bash
npm install -g @flett/design-engineer-studio
```

Start your dev server, then run the CLI in your project directory:

```bash
design-engineer-studio
```

Pass `--port` if your dev server isn't on port 3000:

```bash
design-engineer-studio --port 5173
```

## License

CC BY-NC 4.0 — free to use and modify for non-commercial purposes with attribution. See [LICENSE](LICENSE) for details.
