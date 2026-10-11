import { Linter } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { fsdBoundariesRule } from "../../tooling/eslint/fsd-boundaries.mjs";

const lint = (filename: string, code: string) =>
  new Linter().verify(
    code,
    {
      languageOptions: { ecmaVersion: "latest", sourceType: "module" },
      plugins: { fsd: { rules: { boundaries: fsdBoundariesRule } } },
      rules: { "fsd/boundaries": "error" },
    },
    { filename: path.resolve(filename) },
  );

describe("FSD import boundaries", () => {
  it.each([
    ["src/pages/home/model/page.js", 'import { createModel } from "@/widgets/movie-search";'],
    ["src/widgets/movie-search/model/search.js", 'import { createModel } from "@/features/search-by-file/index";'],
    ["src/widgets/movie-search/ui/search.js", 'import { model } from "../model/search";'],
    ["src/shared/ui/button/ui.js", 'import { cn } from "../../lib/cn";'],
    ["src/pages/routing.js", 'import { HomePage } from "./home";'],
    ["src/pages/home/index.js", 'export { HomePage } from "./ui";'],
    ["src/app/application.js", 'import { Routing } from "@/pages";'],
  ])("allows %s: %s", (filename, code) => {
    expect(lint(filename, code)).toEqual([]);
  });

  it.each([
    ["src/entities/movie/model/model.js", 'import { Search } from "@/widgets/movie-search";', "upward"],
    ["src/features/search-by-file/model/search.js", 'import { Page } from "../../../pages/home";', "upward"],
    ["src/features/search-by-file/model/search.js", 'import { filter } from "@/features/filters";', "sibling"],
    ["src/entities/movie/model/model.js", 'import { session } from "../../session";', "sibling"],
    [
      "src/widgets/movie-search/ui/ui.js",
      'import { query } from "@/features/search-by-file/model/search";',
      "publicApi",
    ],
    ["src/pages/routing.js", 'import { Page } from "./home/ui/page";', "publicApi"],
    ["src/widgets/movie-search/ui/ui.js", 'import { model } from "@/widgets/movie-search/model/search";', "relative"],
    ["src/shared/ui/button/ui.js", 'import { cn } from "@/shared/lib/cn";', "relative"],
    ["src/widgets/movie-search/ui/ui.js", 'import { Movie } from "../../../entities/movie";', "alias"],
    ["src/features/search-by-file/index.js", 'export * from "@/pages/home";', "upward"],
    ["src/features/search-by-file/model/search.js", 'const page = import("@/pages/home");', "upward"],
  ])("rejects %s: %s", (filename, code, messageId) => {
    expect(lint(filename, code)).toEqual([expect.objectContaining({ ruleId: "fsd/boundaries", messageId })]);
  });
});
