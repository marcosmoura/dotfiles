import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: false,
  entry: ["src/extension.ts"],
  format: ["cjs"],
  outDir: "dist",
  platform: "node",
  sourcemap: true,
  target: "es2022",
  deps: {
    neverBundle: ["node-pty", "vscode"],
  },
});
