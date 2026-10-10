export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  let fields: Record<string, string[]> = {};
  try {
    const data = await response.json();
    if (data?.error) message = data.error;
    if (data?.fields) fields = data.fields;
  } catch {
    // Non-JSON error body (e.g. a proxy error page).
  }
  return new ApiError(message, response.status, fields);
}
