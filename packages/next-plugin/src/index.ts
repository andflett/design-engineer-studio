/**
 * Next.js config wrapper that adds the designtools source annotation loader
 * and auto-mounts the <Surface /> selection component in development.
 *
 * Usage:
 *   import { withDesigntools } from "@designtools/next-plugin";
 *   export default withDesigntools({ ...yourConfig });
 */

import path from "path";
import { generateComponentRegistry } from "./preview-route.js";

export function withDesigntools<T extends Record<string, any>>(nextConfig: T = {} as T): T {
  // Generate the component registry unconditionally (filesystem operation, not loader-specific).
  // Use process.cwd() since withDesigntools() is called at config time from the project root.
  const projectRoot = process.cwd();
  const appDir = path.resolve(projectRoot, "app");
  try {
    generateComponentRegistry(appDir);
  } catch {
    // Non-fatal — isolation feature just won't work
  }

  const result: any = {
    ...nextConfig,
    webpack(config: any, context: any) {
      // Only add the loader in development
      if (context.dev) {
        config.module.rules.push({
          test: /\.(tsx|jsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: path.resolve(__dirname, "loader.js"),
              options: {
                cwd: context.dir,
              },
            },
          ],
        });

        // Add a loader for root layout files that auto-mounts <Surface />
        config.module.rules.push({
          test: /layout\.(tsx|jsx)$/,
          include: [
            path.resolve(context.dir, "app"),
            path.resolve(context.dir, "src/app"),
          ],
          use: [
            {
              loader: path.resolve(__dirname, "surface-mount-loader.js"),
            },
          ],
        });
      }

      // Call the user's webpack config if provided
      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, context);
      }

      return config;
    },
  };

  // Turbopack support — register the same loaders via turbopack.rules.
  // Unlike @next/mdx (which converts .mdx → .tsx and needs `as: '*.tsx'`),
  // our loaders transform .tsx → .tsx (same extension), so we must NOT use `as`
  // — that would cause Turbopack to re-append the extension (.tsx.tsx).
  // Instead, use glob patterns that match the file extensions directly.
  if (process.env.TURBOPACK) {
    const sourceLoader = {
      loader: path.resolve(__dirname, "loader.js"),
      options: {
        // In webpack, context.dir provides this. In turbopack config time,
        // process.cwd() is equivalent since next.config runs from the project root.
        cwd: projectRoot,
      },
    };

    const mountLoader = {
      loader: path.resolve(__dirname, "surface-mount-loader.js"),
    };

    // Source annotation loader for all .tsx/.jsx files (excluding node_modules)
    const sourceRule = {
      loaders: [sourceLoader],
      condition: {
        not: "foreign",
      },
    };

    // Mount loader for layout files (the loader itself checks for <html to skip nested layouts)
    const mountRule = {
      loaders: [mountLoader],
      condition: {
        all: [
          { not: "foreign" },
          { path: /layout\.(tsx|jsx)$/ },
        ],
      },
    };

    // Use glob patterns that match tsx/jsx files.
    // The source loader uses separate globs for .tsx and .jsx.
    const existingRules = (nextConfig as any).turbopack?.rules ?? {};

    const tsxRule = existingRules["*.tsx"] ?? [];
    const jsxRule = existingRules["*.jsx"] ?? [];

    result.turbopack = {
      ...(nextConfig as any).turbopack,
      rules: {
        ...existingRules,
        "*.tsx": [
          ...(Array.isArray(tsxRule) ? tsxRule : [tsxRule]),
          sourceRule,
          mountRule,
        ],
        "*.jsx": [
          ...(Array.isArray(jsxRule) ? jsxRule : [jsxRule]),
          sourceRule,
          mountRule,
        ],
      },
    };
  }

  return result as T;
}
