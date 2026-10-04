import { type ApiError, type AuthLoginError, getErrorDetails, zAuthLoginError } from "@/shared/api";

export const getLoginErrorDetails = (error: ApiError): AuthLoginError | null => getErrorDetails(error, zAuthLoginError);
