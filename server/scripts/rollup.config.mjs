import clean from "@rollup-extras/plugin-clean";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.cjs",
    format: "cjs",
  },
  plugins: [
    clean({
      targets: ["dist"],
    }),
    resolve({
      preferBuiltins: true,
      extensions: [".js", ".ts", ".json"],
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: false,
    }),
    json(),
  ],
};
