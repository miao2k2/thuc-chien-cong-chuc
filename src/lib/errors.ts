/** Lỗi nghiệp vụ có message tiếng Việt — API trả về HTTP 400. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isValidationError(e: unknown): e is ValidationError {
  return e instanceof ValidationError || (e as { name?: string })?.name === "ValidationError";
}
