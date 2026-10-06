import { defineConfig } from "@hey-api/openapi-ts";

const dropInt64Format = (node: unknown): void => {
  if (Array.isArray(node)) {
    node.forEach(dropInt64Format);
    return;
  }

  if (node === null || typeof node !== "object") {
    return;
  }

  const record = node as Record<string, unknown>;

  if (record.type === "integer" && record.format === "int64") {
    delete record.format;
  }

  Object.values(record).forEach(dropInt64Format);
};

export default defineConfig({
  input: process.env.OPENAPI_SPEC ?? "../dejaview-docs/api/openapi.yaml",
  output: { path: "src/shared/api/generated" },
  parser: { patch: { input: dropInt64Format } },
  plugins: ["@hey-api/typescript", "zod"],
});
