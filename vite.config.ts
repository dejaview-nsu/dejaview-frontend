// @rolldown/plugin-babel exposes the plugin as its default export (`babelPlugin`);
// there is no named `babel` export.
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    // Vite 8 does not read tsconfig `paths` by default (`resolve.tsconfigPaths`
    // is false), so without this the `@/*` alias resolves in `tsc` and
    // `vite build` but fails on the dev server.
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      react(),
      babel({
        include: /\.(ts|tsx)$/,
        plugins: [["effector/babel-plugin", { factories: ["@withease/factories"] }]],
      }),
      tailwindcss(),
    ],
    server: isDev ? { port: 5173 } : undefined,
  };
});
