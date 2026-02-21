import "./chunk-Y6FXYEAI.mjs";

// src/index.ts
import path from "path";
function withDesigntools(nextConfig = {}) {
  return {
    ...nextConfig,
    webpack(config, context) {
      if (context.dev) {
        config.module.rules.push({
          test: /\.(tsx|jsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: path.resolve(__dirname, "loader.js"),
              options: {
                cwd: context.dir
              }
            }
          ]
        });
        config.module.rules.push({
          test: /layout\.(tsx|jsx)$/,
          include: [
            path.resolve(context.dir, "app"),
            path.resolve(context.dir, "src/app")
          ],
          use: [
            {
              loader: path.resolve(__dirname, "codecanvas-mount-loader.js")
            }
          ]
        });
      }
      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, context);
      }
      return config;
    }
  };
}
export {
  withDesigntools
};
