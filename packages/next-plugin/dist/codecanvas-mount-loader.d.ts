/**
 * Webpack loader that auto-mounts <CodeCanvas /> in the root layout.
 * Only runs in development. Injects the import and component into the JSX.
 *
 * Strategy: Simple string injection — find the {children} pattern in the layout
 * and add <CodeCanvas /> alongside it.
 */
interface LoaderContext {
    resourcePath: string;
    callback(err: Error | null, content?: string): void;
    async(): (err: Error | null, content?: string) => void;
}
declare function codecanvasMountLoader(this: LoaderContext, source: string): void;

export { codecanvasMountLoader as default };
