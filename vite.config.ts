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
    plugins: [react(), tailwindcss()],
    server: { host: env.VITE_URL ?? "localhost", port },
    preview: { port },
  };
});
