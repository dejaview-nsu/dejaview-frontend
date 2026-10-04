import eslintConfigPrettier from "eslint-config-prettier";
import effector from "eslint-plugin-effector";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

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
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-nested-ternary": "error",
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
  eslintConfigPrettier,
);
