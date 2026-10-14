export const ERROR_CODES = [
  "INVALID_ARGUMENT",
  "NOT_FOUND",
  "AMBIGUOUS_QUERY",
  "DATA_UNAVAILABLE",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_RATE_LIMITED",
  "UNSUPPORTED_CAPABILITY",
  "AUTH_REQUIRED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    suggestedAlternatives?: string[];
    candidates?: unknown[];
    retryAfterSeconds?: number;
    provider?: string;
  };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  options: Omit<ErrorResponse["error"], "code" | "message"> = {},
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...options,
    },
  };
}
