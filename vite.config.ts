// @rolldown/plugin-babel exposes the plugin as its default export (`babelPlugin`);
// there is no named `babel` export.
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const port = Number(env.VITE_PORT ?? 5173);

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
    server: { host: env.VITE_URL ?? "localhost", port },
    preview: { port },
  };
});
