export async function readApiResponse(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(response.status === 429
      ? 'The service is busy. The import could not be confirmed. Check your dashboard before trying again, and wait a few minutes.'
      : 'The service could not complete this request. The import could not be confirmed. Check your dashboard before trying again.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The service returned an invalid response. The import could not be confirmed. Check your dashboard before trying again.');
  }
  return payload as Record<string, unknown>;
}
