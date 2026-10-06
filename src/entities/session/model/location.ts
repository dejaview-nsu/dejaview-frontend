import { type Query, stringifyQuery } from "@effector/router";

export const toLocationPath = ({ path, query }: { path: string | null; query: Query }) => {
  const search = stringifyQuery(query);

  return `${path ?? "/"}${search ? `?${search}` : ""}`;
};
