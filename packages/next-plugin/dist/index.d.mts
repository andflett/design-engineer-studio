/**
 * Next.js config wrapper that adds the designtools source annotation loader
 * and auto-mounts the <CodeCanvas /> selection component in development.
 *
 * Usage:
 *   import { withDesigntools } from "@designtools/next-plugin";
 *   export default withDesigntools({ ...yourConfig });
 */
declare function withDesigntools<T extends Record<string, any>>(nextConfig?: T): T;

export { withDesigntools };
