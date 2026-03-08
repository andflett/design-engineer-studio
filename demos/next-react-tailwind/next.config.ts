import type { NextConfig } from "next";
import { withDesigntools } from "@designtools/next-plugin";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
};

export default withDesigntools(nextConfig);
