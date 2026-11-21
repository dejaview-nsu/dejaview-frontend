import { callApi, type UserPasswordChangeRequest, zNoContent } from "@/shared/api";

export const changePassword = (body: UserPasswordChangeRequest) =>
  callApi({ method: "PUT", path: "/users/me/password", body, schema: zNoContent });
