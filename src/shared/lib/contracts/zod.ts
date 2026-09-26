import type { Contract } from "@farfetched/core";
import type { z } from "zod";

export const zodContract = <Data>(schema: z.ZodType<Data>): Contract<unknown, Data> => ({
  isData: (raw): raw is Data => schema.safeParse(raw).success,
  getErrorMessages: (raw) => {
    const result = schema.safeParse(raw);

    return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  },
});
