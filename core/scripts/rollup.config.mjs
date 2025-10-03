import clean from "@rollup-extras/plugin-clean";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import packageJson from "../package.json" with { type: "json" };

const { dependencies } = packageJson;

export default [
  // JavaScript bundle
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "esm",
      sourcemap: true,
    },
    external: Object.keys(dependencies || {}),
    plugins: [
      clean({
        targets: ["dist"],
      }),
      resolve({
        preferBuiltins: true,
        extensions: [".js", ".ts", ".json"],
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
      }),
    ],
  },
  // TypeScript definitions bundle
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "esm",
    },
    external: Object.keys(dependencies || {}),
    plugins: [dts()],
  },
];
