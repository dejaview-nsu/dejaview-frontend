import eslintConfigPrettier from "eslint-config-prettier";
import effector from "eslint-plugin-effector";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

import { fsdBoundariesRule } from "./tooling/eslint/fsd-boundaries.mjs";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules", "src/shared/api/generated"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { effector, unicorn },
    rules: {
      ...effector.configs.recommended.rules,
      ...effector.configs.react.rules,
      ...effector.configs.scope.rules,
      ...effector.configs.future.rules,
      ...effector.configs.patronum.rules,
      // These hooks read a model from React context; they do not create Effector units.
      "effector/no-units-spawn-in-render": [
        "error",
        { detectCustomFactories: { allowlist: ["useMovieSearchModel", "useModel"] } },
      ],
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-nested-ternary": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name=/^(on|reset)$/][callee.object.name=/^\\$/]",
          message: "Update and reset Effector stores with sample({ clock, source, fn, target }).",
        },
        {
          selector: "CallExpression[callee.property.name=/^(on|reset)$/][callee.object.property.name=/^\\$/]",
          message: "Update and reset Effector stores with sample({ clock, source, fn, target }).",
        },
        {
          selector: "CallExpression[callee.property.name=/^(on|reset)$/][callee.object.callee.name='createStore']",
          message: "Update and reset Effector stores with sample({ clock, source, fn, target }).",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "clsx",
              message: "Please use cn from @/shared/lib/cn instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: { fsd: { rules: { boundaries: fsdBoundariesRule } } },
    rules: { "fsd/boundaries": "error" },
  },
  eslintConfigPrettier,
);
