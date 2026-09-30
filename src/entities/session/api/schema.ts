import { z } from "zod";

export const sessionInfoSchema = z.object({
  user: z.object({
    username: z.string(),
    avatar_url: z.string().nullable(),
    has_password: z.boolean(),
  }),
  expires_at: z.string(),
});

export type SessionInfo = z.output<typeof sessionInfoSchema>;
export type SessionUser = SessionInfo["user"];
