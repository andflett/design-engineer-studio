import path from "path";

/**
 * Resolves a user-provided relative file path against projectRoot,
 * ensuring the result stays within projectRoot. Prevents path traversal
 * attacks (e.g. "../../etc/passwd").
 *
 * Throws if:
 * - The resolved path escapes projectRoot
 * - The path is absolute (must be relative)
 * - The path is empty
 */
export function safePath(projectRoot: string, filePath: string): string {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("File path is required");
  }

  // Reject absolute paths — all file paths from the client must be relative
  if (path.isAbsolute(filePath)) {
    throw new Error(
      `Absolute paths are not allowed: "${filePath}". Paths must be relative to the project root.`
    );
  }

  const resolvedRoot = path.resolve(projectRoot);
  const resolvedPath = path.resolve(resolvedRoot, filePath);

  // Ensure the resolved path is within projectRoot
  // Use separator suffix to prevent prefix matching (e.g. /foo-bar matching /foo)
  if (
    resolvedPath !== resolvedRoot &&
    !resolvedPath.startsWith(resolvedRoot + path.sep)
  ) {
    throw new Error(
      `Path "${filePath}" resolves outside the project directory. Refusing to write.`
    );
  }

  return resolvedPath;
}
