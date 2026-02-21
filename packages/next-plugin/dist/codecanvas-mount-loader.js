"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/codecanvas-mount-loader.ts
var codecanvas_mount_loader_exports = {};
__export(codecanvas_mount_loader_exports, {
  default: () => codecanvasMountLoader
});
module.exports = __toCommonJS(codecanvas_mount_loader_exports);
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
