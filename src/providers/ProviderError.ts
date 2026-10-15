import type { ErrorCode } from "../domain/errors.js";

/**
 * A provider failure that can be returned to MCP clients without being
 * collapsed into an INTERNAL_ERROR.
 */
export class ProviderError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly options: {
      suggestedAlternatives?: string[];
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
