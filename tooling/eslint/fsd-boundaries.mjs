import path from "node:path";

const srcRoot = path.resolve(import.meta.dirname, "../../src");
const layers = ["app", "pages", "layouts", "widgets", "features", "entities", "shared"];
const slicedLayers = new Set(["pages", "layouts", "widgets", "features", "entities"]);

const describePath = (filename) => {
  const relative = path.relative(srcRoot, filename);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const parts = relative.split(path.sep);
  const layer = parts[0];
  if (!layers.includes(layer)) return null;
  const slice = slicedLayers.has(layer) && parts[1] && !path.extname(parts[1]) ? parts[1] : null;
  return { layer, slice, parts };
};

/** @type {import("eslint").Rule.RuleModule} */
export const fsdBoundariesRule = {
  meta: {
    type: "problem",
    docs: { description: "Enforce FSD layer direction, slice isolation and public APIs." },
    schema: [],
    messages: {
      upward: "FSD: {{from}} cannot import the higher layer {{to}}.",
      sibling: "FSD: slices in {{layer}} cannot import one another ({{from}} → {{to}}).",
      publicApi: "FSD: import {{slice}} through its root index.ts, not {{source}}.",
      relative: "FSD: use relative imports within {{layer}}.",
      alias: "FSD: use @/ imports between layers ({{from}} → {{to}}).",
    },
  },
  create(context) {
    const origin = describePath(context.filename);
    if (!origin) return {};

    const check = (node) => {
      const source = node.source?.value;
      if (typeof source !== "string") return;
      const alias = source.startsWith("@/");
      if (!alias && !source.startsWith(".")) return;
      const filename = alias
        ? path.resolve(srcRoot, source.slice(2))
        : path.resolve(path.dirname(context.filename), source);
      const target = describePath(filename);
      if (!target) return;

      if (layers.indexOf(target.layer) < layers.indexOf(origin.layer)) {
        context.report({ node, messageId: "upward", data: { from: origin.layer, to: target.layer } });
        return;
      }
      if (target.layer === origin.layer) {
        if (origin.slice && target.slice && origin.slice !== target.slice) {
          context.report({
            node,
            messageId: "sibling",
            data: { layer: origin.layer, from: origin.slice, to: target.slice },
          });
          return;
        }
        if (alias) context.report({ node, messageId: "relative", data: { layer: origin.layer } });
      } else if (!alias) {
        context.report({ node, messageId: "alias", data: { from: origin.layer, to: target.layer } });
      }

      const sameSlice = origin.layer === target.layer && origin.slice === target.slice;
      const internal = target.parts.slice(2);
      const isPublicApi =
        internal.length === 0 || (internal.length === 1 && /^index(?:\.[cm]?[jt]sx?)?$/.test(internal[0]));
      if (target.slice && !sameSlice && !isPublicApi) {
        context.report({
          node,
          messageId: "publicApi",
          data: { slice: `${target.layer}/${target.slice}`, source },
        });
      }
    };

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};
