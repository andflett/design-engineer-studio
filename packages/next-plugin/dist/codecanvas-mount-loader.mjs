import "./chunk-Y6FXYEAI.mjs";

// src/codecanvas-mount-loader.ts
function codecanvasMountLoader(source) {
  const callback = this.async();
  if (!source.includes("<html")) {
    callback(null, source);
    return;
  }
  if (source.includes("CodeCanvas")) {
    callback(null, source);
    return;
  }
  const importStatement = `import { CodeCanvas } from "@designtools/next-plugin/codecanvas";
`;
  let modified = source;
  const firstImportIndex = source.indexOf("import ");
  if (firstImportIndex !== -1) {
    modified = source.slice(0, firstImportIndex) + importStatement + source.slice(firstImportIndex);
  } else {
    modified = importStatement + source;
  }
  modified = modified.replace(
    /(\{children\})/,
    `<CodeCanvas />
          $1`
  );
  callback(null, modified);
}
export {
  codecanvasMountLoader as default
};
